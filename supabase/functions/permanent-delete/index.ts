/**
 * Edge Function — 만료된 탈퇴 사용자 영구 삭제 (FR-036).
 *
 * 트리거: pg_cron daily (별도 마이그레이션에서 등록)
 * 권한: service role
 *
 * 동작:
 *   permanent_delete_at <= now() AND withdrawal_requested_at IS NOT NULL
 *   인 사용자에 대해 auth.users 삭제 → public.users CASCADE 삭제 →
 *   ingredients/sales/etc. CASCADE 삭제.
 *
 * 멱등성: 이미 삭제된 사용자는 영향 없음 (조건이 0 row 반환).
 */

// @ts-expect-error: Deno runtime, deno.serve is global in Supabase Edge Functions.
import { createClient } from "jsr:@supabase/supabase-js@2";

interface DeletionResult {
  success: boolean;
  deletedCount: number;
  errors: Array<{ userId: string; message: string }>;
}

// @ts-expect-error: Deno global available at runtime in Supabase Edge.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// @ts-expect-error: Deno global available at runtime in Supabase Edge.
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// @ts-expect-error: Deno.serve is global in Supabase Edge Functions.
Deno.serve(async (): Promise<Response> => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return Response.json({ success: false, error: "missing env" }, { status: 500 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: candidates, error: queryError } = await admin
    .from("users")
    .select("id")
    .lte("permanent_delete_at", new Date().toISOString())
    .not("withdrawal_requested_at", "is", null);

  if (queryError) {
    return Response.json({ success: false, error: queryError.message }, { status: 500 });
  }

  const result: DeletionResult = {
    success: true,
    deletedCount: 0,
    errors: [],
  };

  for (const row of candidates ?? []) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(row.id);
    if (deleteError) {
      result.errors.push({ userId: row.id, message: deleteError.message });
      continue;
    }
    result.deletedCount += 1;
  }

  return Response.json(result);
});
