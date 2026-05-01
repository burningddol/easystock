/**
 * Edge Function — D7 retention tracker (Phase 8 / T166).
 * 트리거: pg_cron이 pg_net으로 HTTP POST (027_d7_tracker_cron.sql, 매일 KST 11:00).
 *
 * 로직: "가입 7일째 + 24h 내 sale 입력" 코호트 → GA4 Measurement Protocol로 d7_active 발화.
 * KST cohort window — UTC 단순 비교는 KST 저녁 가입자가 다음 UTC 날짜로 넘어가 누락.
 * push-scheduler와 동일 GA4 secrets (GA4_MEASUREMENT_ID + GA4_API_SECRET) 공유 — 미설정 시 no-op.
 *
 * client_id로 user.id (UUIDv4) 그대로 사용 — 외부 시스템에서 PII로 연결 불가능한 무작위 식별자.
 */

// @ts-expect-error: Deno runtime
import { createClient } from "jsr:@supabase/supabase-js@2";

// @ts-expect-error: Deno global
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// @ts-expect-error: Deno global
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// @ts-expect-error: Deno global
const GA4_MEASUREMENT_ID = Deno.env.get("GA4_MEASUREMENT_ID") ?? "";
// @ts-expect-error: Deno global
const GA4_API_SECRET = Deno.env.get("GA4_API_SECRET") ?? "";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Ga4Result {
  ok: boolean;
}

async function reportD7Active(userId: string, signupDate: string): Promise<Ga4Result> {
  if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET) return { ok: false };
  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
      {
        method: "POST",
        body: JSON.stringify({
          client_id: userId,
          events: [{ name: "d7_active", params: { signup_date: signupDate } }],
        }),
      },
    );
    return { ok: res.ok };
  } catch (err) {
    console.warn("ga4 dispatch failed", err);
    return { ok: false };
  }
}

/** "가입 7일째" 코호트의 KST 기준 날짜 → UTC 윈도우 [start, end). */
function kstCohortWindow(now: Date): { date: string; startIso: string; endIso: string } {
  // KST = UTC+9. now를 +9h 시프트해 그 시각의 KST 날짜를 계산 → 7일 빼기.
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 7 * DAY_MS);
  const date = shifted.toISOString().slice(0, 10);
  const startIso = `${date}T00:00:00+09:00`;
  // 다음날 0시 KST = startIso + 24h
  const endIso = new Date(new Date(startIso).getTime() + DAY_MS).toISOString();
  return { date, startIso, endIso };
}

// @ts-expect-error: Deno.serve global
Deno.serve(async (): Promise<Response> => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return Response.json({ success: false, error: "missing env" }, { status: 500 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cohort = kstCohortWindow(new Date());

  const { data: candidates, error: queryError } = await admin
    .from("users")
    .select("id, signed_up_at")
    .gte("signed_up_at", cohort.startIso)
    .lt("signed_up_at", cohort.endIso)
    .is("withdrawal_requested_at", null);

  if (queryError) {
    return Response.json({ success: false, error: queryError.message }, { status: 500 });
  }

  const users = candidates ?? [];
  if (users.length === 0) {
    return Response.json({ success: true, candidates_count: 0, sent_count: 0 });
  }

  // N+1 회피: 24h 활성 사용자 ID set을 단일 쿼리로 조회.
  const since24h = new Date(Date.now() - DAY_MS).toISOString();
  const userIds = users.map((u) => u.id);
  const { data: activeRows, error: activityError } = await admin
    .from("sales")
    .select("user_id")
    .in("user_id", userIds)
    .gte("created_at", since24h);

  if (activityError) {
    return Response.json({ success: false, error: activityError.message }, { status: 500 });
  }

  const activeSet = new Set((activeRows ?? []).map((r) => r.user_id));

  let sentCount = 0;
  let failedCount = 0;
  for (const user of users) {
    if (!activeSet.has(user.id)) continue;
    const result = await reportD7Active(user.id, user.signed_up_at.slice(0, 10));
    if (result.ok) sentCount += 1;
    else failedCount += 1;
  }

  return Response.json({
    success: true,
    cohort_date_kst: cohort.date,
    candidates_count: users.length,
    active_count: activeSet.size,
    sent_count: sentCount,
    failed_count: failedCount,
  });
});
