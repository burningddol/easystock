/**
 * Edge Function — 푸시 알림 스케줄러.
 * 계약: specs/001-mvp-core/contracts/push.md
 *
 * 트리거: pg_cron이 pg_net으로 HTTP POST (023_push_cron_schedules.sql).
 * 입력: { type: 'order_alert' | 'closing_reminder' | 'stock_count' | 'critical_depletion' }
 *
 * 각 type별로:
 *  - 대상 사용자 쿼리 (정기휴무 요일 제외)
 *  - 사용자별 push_subscriptions에 web-push 발송
 *  - 발송 실패한 endpoint는 그대로 유지 (다음 cron 시 재시도) — 410/404 응답이면 삭제
 *
 * VAPID 키는 Supabase Edge Function secrets에 설정:
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 */

// @ts-expect-error: Deno runtime
import { createClient } from "jsr:@supabase/supabase-js@2";
// @ts-expect-error: Deno runtime
import webpush from "npm:web-push@3";

type AlertType = "order_alert" | "closing_reminder" | "stock_count" | "critical_depletion";

interface PushPayload {
  title: string;
  body: string;
  url: string;
  type: AlertType;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

// @ts-expect-error: Deno global
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// @ts-expect-error: Deno global
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// @ts-expect-error: Deno global
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
// @ts-expect-error: Deno global
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
// @ts-expect-error: Deno global
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@easystock.app";
// GA4 Measurement Protocol — d7-tracker와 동일 secrets 공유 (GA4_MEASUREMENT_ID +
// GA4_API_SECRET). 미설정 시 reportToGa4 no-op.
// @ts-expect-error: Deno global
const GA4_MEASUREMENT_ID = Deno.env.get("GA4_MEASUREMENT_ID") ?? "";
// @ts-expect-error: Deno global
const GA4_API_SECRET = Deno.env.get("GA4_API_SECRET") ?? "";

const GA4_EVENT_NAME: Record<AlertType, string> = {
  order_alert: "order_alert_received",
  closing_reminder: "closing_reminder_received",
  stock_count: "stock_count_reminder_received",
  critical_depletion: "critical_depletion_received",
};

async function reportToGa4(type: AlertType, sentCount: number): Promise<void> {
  if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET || sentCount === 0) return;
  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
      {
        method: "POST",
        body: JSON.stringify({
          client_id: "push-scheduler-edge-fn",
          events: [{ name: GA4_EVENT_NAME[type], params: { type, sent_count: sentCount } }],
        }),
      },
    );
  } catch (err) {
    // 측정 실패는 푸시 발송 결과에 영향 없음 — log로만 기록.
    console.warn("ga4 dispatch failed", err);
  }
}

const KOREAN_WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

// @ts-expect-error: Deno.serve global
Deno.serve(async (req: Request): Promise<Response> => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return Response.json({ success: false, error: "missing env" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { type?: AlertType };
  const type = body.type;
  if (!type) {
    return Response.json({ success: false, error: "missing type" }, { status: 400 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // KST 기준 오늘 요일 — UTC getUTCDay()는 KST 자정~UTC 09:00 구간에서 하루 밀린다.
  // (FR-041 정기휴무 누락 방지). d7-tracker의 KST cohort window와 동일 +9h shift.
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const todayWeekday = KOREAN_WEEKDAYS[new Date(Date.now() + KST_OFFSET_MS).getUTCDay()];

  // FR-036 탈퇴 신청자 제외 + FR-041 정기휴무 사용자는 루프 안에서 todayWeekday 비교로 제외.
  const { data: targets, error: queryError } = await admin
    .from("users")
    .select("id, regular_days_off, push_subscriptions(id, endpoint, keys_p256dh, keys_auth)")
    .is("withdrawal_requested_at", null);

  if (queryError) {
    return Response.json({ success: false, error: queryError.message }, { status: 500 });
  }

  const payload = buildPayload(type);
  let sentCount = 0;
  let removedCount = 0;
  const errors: Array<{ endpoint: string; status: number }> = [];

  for (const user of targets ?? []) {
    if ((user.regular_days_off ?? []).includes(todayWeekday)) continue;
    const subs = (user.push_subscriptions ?? []) as PushSubscriptionRow[];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          JSON.stringify(payload),
        );
        sentCount += 1;
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode ?? 0;
        // 410 Gone / 404 Not Found → 구독 만료, 삭제
        if (status === 410 || status === 404) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
          removedCount += 1;
        } else {
          errors.push({ endpoint: sub.endpoint, status });
        }
      }
    }
  }

  await reportToGa4(type, sentCount);

  return Response.json({ success: true, type, sentCount, removedCount, errors });
});

function buildPayload(type: AlertType): PushPayload {
  switch (type) {
    case "order_alert":
      return {
        type,
        title: "오늘 발주 점검",
        body: "재고가 모자란 재료가 있어요. 재고 화면에서 확인하세요.",
        url: "/inventory",
      };
    case "closing_reminder":
      return {
        type,
        title: "마감 후 판매 입력",
        body: "오늘 판매를 1분 안에 입력하면 마진이 바로 계산돼요.",
        url: "/sale",
      };
    case "stock_count":
      return {
        type,
        title: "주간 재고 실사",
        body: "이번 주 손실액을 확인하려면 실사를 진행하세요.",
        url: "/inventory/stock-count",
      };
    case "critical_depletion":
      return {
        type,
        title: "재료 소진 임박",
        body: "당일/익일 소진 가능성이 있는 재료가 있어요.",
        url: "/inventory",
      };
  }
}
