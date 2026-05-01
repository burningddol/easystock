/**
 * Edge Function — 만료된 탈퇴 사용자 영구 삭제 (FR-036).
 * 트리거: pg_cron daily. permanent_delete_at <= now() + withdrawal_requested_at NOT NULL인
 * auth.users를 삭제 → DB cascade (스키마 정의 참조). 멱등 — 0 row 시 no-op.
 */

// @ts-expect-error: Deno runtime
import { createClient } from "jsr:@supabase/supabase-js@2";

interface DeletionResult {
  success: boolean;
  deletedCount: number;
  errors: Array<{ userId: string; message: string }>;
}

// @ts-expect-error: Deno global
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// @ts-expect-error: Deno global
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// @ts-expect-error: Deno.serve global
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

  // 부분 실패가 cron 모니터(pg_net._http_response)에서 보이도록 207 multi-status.
  if (result.errors.length > 0) {
    result.success = false;
    return Response.json(result, { status: 207 });
  }
  return Response.json(result);
});
