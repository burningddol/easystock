"use client";

interface MonthHeaderProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/**
 * 월간 캘린더 헤더 (patterns.md "캘린더" 위계 #1).
 * "2026년 4월" + 이전/다음 달 네비 + 오늘로 돌아가기.
 */
export function MonthHeader({
  year,
  month,
  onPrev,
  onNext,
  onToday,
}: MonthHeaderProps): React.ReactElement {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-stack">
        <NavButton ariaLabel="이전 달" onClick={onPrev}>
          ‹
        </NavButton>
        <h1 className="text-title-lg text-ink-1 tabular-nums">
          {year}년 {month}월
        </h1>
        <NavButton ariaLabel="다음 달" onClick={onNext}>
          ›
        </NavButton>
      </div>
      <button
        type="button"
        onClick={onToday}
        className="rounded-md border border-border px-2 py-1 text-caption text-ink-3"
      >
        오늘
      </button>
    </header>
  );
}

interface NavButtonProps {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}

function NavButton({ ariaLabel, onClick, children }: NavButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-ink-1"
    >
      {children}
    </button>
  );
}
