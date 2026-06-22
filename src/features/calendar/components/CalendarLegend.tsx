"use client";

import { INTENSITY_LEVELS, INTENSITY_STEP_PCT } from "../lib/intensity";
import { CALENDAR_SHORT_FORECAST_DAYS } from "../lib/forecast-window";

/**
 * 캘린더 범례 — 인텐시티 5단계 + 매입/누락 도트 설명.
 */
export function CalendarLegend(): React.ReactElement {
  return (
    <section
      aria-label="캘린더 범례"
      className="flex flex-col gap-stack-tight rounded-lg border border-border bg-card p-tile text-caption text-ink-3"
    >
      <div className="flex items-center gap-stack-tight">
        <span className="text-micro">매출</span>
        <IntensityScale />
      </div>
      <div className="flex flex-wrap items-center gap-stack-tight">
        <DotKey tone="amber" label="매입 있음" />
        <DotKey tone="red" label="판매 미입력" />
      </div>
      <p className="text-micro text-ink-4">
        예상 매출은 오늘부터 {CALENDAR_SHORT_FORECAST_DAYS}일 이내 단기 예측만 표시합니다.
      </p>
    </section>
  );
}

function IntensityScale(): React.ReactElement {
  const levels = Array.from({ length: INTENSITY_LEVELS + 1 }, (_, i) => i);
  return (
    <div className="flex items-center gap-1">
      {levels.map((level) => (
        <div
          key={level}
          className="h-3 w-3 rounded-sm"
          style={{
            backgroundColor: `color-mix(in srgb, var(--ink-1) ${level * INTENSITY_STEP_PCT}%, var(--card))`,
          }}
        />
      ))}
      <span className="ml-1 text-micro">낮음 → 높음</span>
    </div>
  );
}

interface DotKeyProps {
  tone: "amber" | "red";
  label: string;
}

function DotKey({ tone, label }: DotKeyProps): React.ReactElement {
  const cls = tone === "amber" ? "bg-amber" : "bg-red";
  return (
    <span className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
