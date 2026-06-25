"use client";

import Link from "next/link";

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
    <header className="glow-panel rounded-[28px] border border-border bg-card px-5 py-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-stack">
          <NavButton ariaLabel="이전 달" onClick={onPrev}>
            ‹
          </NavButton>
          <div className="flex flex-col">
            <span className="text-micro uppercase tracking-[0.14em] text-blue-deep">Calendar</span>
            <h1 className="text-title-lg text-ink-1 tabular-nums">
              {year}년 {month}월
            </h1>
          </div>
          <NavButton ariaLabel="다음 달" onClick={onNext}>
            ›
          </NavButton>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/inventory/forecast?tab=revenue"
            className="hidden rounded-xl border border-border bg-card px-3 py-2 text-caption font-semibold text-ink-2 shadow-soft transition hover:bg-card-hover sm:inline-flex"
          >
            매출 예측
          </Link>
          <button
            type="button"
            onClick={onToday}
            className="rounded-xl border border-border bg-card px-3 py-2 text-caption text-ink-2 shadow-soft transition hover:bg-card-hover"
          >
            오늘
          </button>
        </div>
      </div>
      <Link
        href="/inventory/forecast?tab=revenue"
        className="mt-3 inline-flex rounded-xl border border-border bg-card px-3 py-2 text-caption font-semibold text-ink-2 shadow-soft transition hover:bg-card-hover sm:hidden"
      >
        매출 예측 보기
      </Link>
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
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-ink-1 shadow-soft transition hover:bg-card-hover"
    >
      {children}
    </button>
  );
}
