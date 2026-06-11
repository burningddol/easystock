import Link from "next/link";
import { SignupForm } from "@/features/auth/components/SignupForm";

export default function SignupPage(): React.ReactElement {
  return (
    <div className="page-shell mx-auto flex min-h-screen max-w-screen-md flex-col justify-center gap-section p-screen pb-24">
      <header className="glow-panel rounded-[32px] border border-border bg-card px-6 py-6 shadow-card">
        <div className="flex flex-col gap-stack-tight">
          <p className="text-micro uppercase tracking-[0.14em] text-blue-deep">EasyStock</p>
          <h1 className="text-title-lg text-ink-1">이지스톡 가입</h1>
          <p className="text-body-regular text-ink-3">
            매일 5분 입력으로 메뉴별 마진과 재료 소진 예측을 받아보세요.
          </p>
        </div>
      </header>

      <SignupForm />

      <p className="text-center text-body-regular text-ink-3">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-blue-deep underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
