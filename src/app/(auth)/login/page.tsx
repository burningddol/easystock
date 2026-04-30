import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage(): React.ReactElement {
  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-stack-tight">
        <h1 className="text-title-lg text-ink-1">로그인</h1>
        <p className="text-body-regular text-ink-3">이지스톡으로 오신 것을 환영합니다.</p>
      </header>

      <Suspense fallback={<p className="text-body-regular text-ink-3">불러오는 중…</p>}>
        <LoginForm />
      </Suspense>

      <p className="text-center text-body-regular text-ink-3">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="text-ink-1 underline">
          가입하기
        </Link>
      </p>
    </div>
  );
}
