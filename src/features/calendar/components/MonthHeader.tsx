"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

interface MonthHeaderProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * 월간 캘린더 헤더 (patterns.md "캘린더" 위계 #1).
 * "2026년 4월" + 이전/다음 달 네비 + 캘린더 예측.
 */
export function MonthHeader({ year, month, onPrev, onNext }: MonthHeaderProps): React.ReactElement {
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
        <CalendarActions />
      </div>
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

function CalendarActions(): React.ReactElement {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center justify-center gap-1 rounded-2xl border border-border-strong bg-white px-4 py-3 text-body-regular font-semibold text-ink-1 shadow-soft transition hover:-translate-y-0.5 hover:border-blue/30 hover:bg-blue-soft [&::-webkit-details-marker]:hidden">
        <span>예측</span>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          aria-hidden="true"
          className="transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-44 overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-card">
        {CALENDAR_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="block rounded-xl px-3 py-2.5 text-caption font-semibold text-ink-1 transition hover:bg-blue-soft hover:text-blue-deep"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

const CALENDAR_ACTIONS = [
  { href: "/inventory/forecast?tab=revenue", label: "매출 예측" },
  { href: "/inventory/forecast-accuracy?tab=revenue", label: "예측 정확도" },
] as const;
