import Link from "next/link";

export default function SettingsPage(): React.ReactElement {
  return (
    <main className="mx-auto flex min-h-screen max-w-screen-md flex-col gap-section p-screen pb-20">
      <header className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink-1">가게 설정</h1>
        <Link href="/today" className="text-body-regular text-ink-3 hover:text-ink-2">
          닫기
        </Link>
      </header>
      <p className="text-body-regular text-ink-3">
        가게 정보 / 정기휴무 / 탈퇴 — 정기휴무 편집기는 PR 10에서 구현
      </p>
    </main>
  );
}
