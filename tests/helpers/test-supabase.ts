import { describe } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * 통합 테스트용 Supabase 헬퍼.
 *
 * 헌법 IV (RLS 가드) 통합 테스트는 실제 Supabase 인스턴스가 있어야 의미 있음.
 * CI/로컬에서 환경변수가 없으면 호출 측이 `describe.skipIf(!hasSupabaseTestEnv)`로
 * 건너뛴다 — 테스트는 발견되지만 실행은 실제 환경에서만.
 *
 * Service role 클라이언트는 RLS를 우회 → 픽스처 정리/생성용.
 * 사용자별 클라이언트는 anon key + 로그인된 세션 → RLS 검증용.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// CI workflow가 secret 미설정 시 placeholder fallback을 주입하므로 명시적으로 제외.
const isPlaceholder = (v?: string): boolean =>
  !v || v === "placeholder" || v.includes("placeholder.supabase.co");

export const hasSupabaseTestEnv =
  !isPlaceholder(SUPABASE_URL) && !isPlaceholder(SERVICE_ROLE_KEY) && !isPlaceholder(ANON_KEY);

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

function requireEnv(): { url: string; serviceRoleKey: string; anonKey: string } {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    throw new Error(
      "Supabase test env not configured: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY required",
    );
  }
  return { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY, anonKey: ANON_KEY };
}

export function getServiceRoleClient(): SupabaseClient<Database> {
  const { url, serviceRoleKey } = requireEnv();
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createTestUser(overrides?: {
  storeName?: string;
  storeType?: "bingsu_cafe" | "cafe" | "dessert_cafe";
}): Promise<TestUser> {
  const admin = getServiceRoleClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `rls-test-${suffix}@easystock.test`;
  const password = `Test!${suffix}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      store_name: overrides?.storeName ?? `테스트가게-${suffix}`,
      store_type: overrides?.storeType ?? "bingsu_cafe",
      regular_days_off: [],
    },
  });

  if (error || !data.user) {
    throw new Error(`createTestUser failed: ${error?.message ?? "no user returned"}`);
  }

  return { id: data.user.id, email, password };
}

export async function cleanupTestUser(userId: string): Promise<void> {
  const admin = getServiceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && !error.message.includes("not found")) {
    throw new Error(`cleanupTestUser failed: ${error.message}`);
  }
}

/** Supabase env이 있는 환경에서만 통합 테스트 suite 실행 — 9개 파일에서 반복되던 패턴. */
export const describeIfSupabase = hasSupabaseTestEnv ? describe : describe.skip;

/**
 * UTC 기준 N일 오프셋 ISO date (YYYY-MM-DD).
 * 로컬 setDate 변형은 DST 경계에서 ±1일 — 서버 current_date (UTC)와 일치시키려면 UTC.
 */
export function isoDate(offsetDays: number = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** 가입일 backdate — calendar/sale 테스트에서 과거 데이터 검증용. */
export async function backdateSignup(userId: string, isoDateStr: string): Promise<void> {
  const admin = getServiceRoleClient();
  await admin.from("users").update({ signed_up_at: isoDateStr }).eq("id", userId);
}

export async function signInAs(user: TestUser): Promise<SupabaseClient<Database>> {
  const { url, anonKey } = requireEnv();
  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw new Error(`signInAs failed: ${error.message}`);
  }

  return client;
}
