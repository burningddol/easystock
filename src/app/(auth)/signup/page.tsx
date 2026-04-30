import Link from "next/link";
import { SignupForm } from "@/features/auth/components/SignupForm";

export default function SignupPage(): React.ReactElement {
  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-stack-tight">
        <h1 className="text-title-lg text-ink-1">이지스톡 가입</h1>
        <p className="text-body-regular text-ink-3">
          매일 5분 입력으로 메뉴별 마진과 재료 소진 예측을 받아보세요.
        </p>
      </header>

      <SignupForm />

      <p className="text-center text-body-regular text-ink-3">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-ink-1 underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
