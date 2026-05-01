import { redirect } from "next/navigation";

// `/` 진입은 middleware가 user 상태에 따라 /today 또는 /login으로 redirect 함.
// 이 RSC는 미들웨어 우회 시(매처 변경 등)에 대비한 안전망 — 기본적으로 /login.
export default function RootPage(): never {
  redirect("/login");
}
