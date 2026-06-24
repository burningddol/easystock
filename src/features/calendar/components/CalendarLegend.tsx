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
      className="hidden flex-col gap-stack-tight rounded-lg border border-border bg-card p-tile text-caption text-ink-3 sm:flex"
    >
      <div className="flex items-center gap-stack-tight">
        <span className="text-micro font-semibold text-ink-2">배경 진하기</span>
        <IntensityScale />
      </div>
      <div className="flex flex-wrap items-center gap-stack-tight">
        <BadgeKey tone="ink" sample="매출 50만" label="실제 매출" />
        <BadgeKey tone="red" sample="+8만" label="예상보다 많이 나옴" />
        <BadgeKey tone="blue" sample="-8만" label="예상보다 적게 나옴" />
        <BadgeKey tone="ink" sample="0만" label="예상과 거의 일치" />
        <BadgeKey tone="blue" sample="예상 27만" label="미래 예상 매출" />
        <BadgeKey tone="red" sample="누락" label="판매 입력 필요" />
        <DotKey tone="amber" label="매입 있음" />
      </div>
      <p className="text-micro text-ink-4">
        숫자는 만원 단위입니다. 오차 색상은 크기가 아니라 방향입니다. 예상 매출은 오늘부터{" "}
        {CALENDAR_SHORT_FORECAST_DAYS}일 이내 단기 예측만 표시합니다.
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

interface BadgeKeyProps {
  tone: "ink" | "blue" | "red";
  sample: string;
  label: string;
}

function BadgeKey({ tone, sample, label }: BadgeKeyProps): React.ReactElement {
  return (
    <span className="flex items-center gap-1">
      <span
        className={`rounded-full px-2 py-1 text-micro font-semibold leading-none ${
          tone === "red"
            ? "bg-red-soft text-red-deep"
            : tone === "blue"
              ? "bg-blue-soft text-blue-deep"
              : "bg-white text-ink-1 shadow-soft"
        }`}
      >
        {sample}
      </span>
      <span>{label}</span>
    </span>
  );
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
