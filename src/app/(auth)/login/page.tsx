import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage(): React.ReactElement {
  return (
    <div className="page-shell mx-auto flex min-h-screen max-w-screen-md flex-col justify-center gap-section p-screen pb-24">
      <header className="glow-panel rounded-[32px] border border-border bg-card px-6 py-6 shadow-card">
        <div className="flex flex-col gap-stack-tight">
          <p className="text-micro uppercase tracking-[0.14em] text-blue-deep">EasyStock</p>
          <h1 className="text-title-lg text-ink-1">로그인</h1>
          <p className="text-body-regular text-ink-3">이지스톡으로 오신 것을 환영합니다.</p>
        </div>
      </header>

      <Suspense fallback={<p className="text-body-regular text-ink-3">불러오는 중…</p>}>
        <LoginForm />
      </Suspense>

      <p className="text-center text-body-regular text-ink-3">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-semibold text-blue-deep underline">
          가입하기
        </Link>
      </p>
    </div>
  );
}
