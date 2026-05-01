import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 루트 라우트 — 인증 상태에 따라 즉시 분기.
 *  - 로그인 → /today (홈 대시보드)
 *  - 비로그인 → /login
 *
 * RSC 단계에서 redirect()로 처리 — 사용자에게 placeholder가 잠시도 안 보이도록.
 */
export default async function RootPage(): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/today" : "/login");
}
