import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 루트 라우트 — 로그인 상태면 /today, 아니면 /login. RSC redirect로 placeholder 노출 차단.
export default async function RootPage(): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/today" : "/login");
}
