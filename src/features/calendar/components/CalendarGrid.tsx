"use client";

import { cn } from "@/lib/utils";
import { WEEKDAY_KO, formatNumber, parseLocalDateFromIso } from "@/lib/utils/format";
import type { EnrichedCalendarCell } from "../lib/consecutive-missing";
import { INTENSITY_LEVELS, INTENSITY_STEP_PCT } from "../lib/intensity";
import type { CalendarMenuForecastSummary } from "../lib/menu-forecast-calendar";

interface CalendarGridProps {
  year: number;
  month: number;
  cells: readonly EnrichedCalendarCell[];
  menuForecastByDate?: ReadonlyMap<string, CalendarMenuForecastSummary>;
  selectedDate: string | null;
  todayIso: string | null;
  onSelect: (cell: EnrichedCalendarCell) => void;
}

/**
 * 7×6 월간 그리드 (patterns.md "캘린더" 위계 #3).
 * 셀 배경 = 매출 인텐시티 5단계, 우상 도트 = 매입(amber)/누락(red),
 * 좌하 = 매출 만원 단위, 미래/가입전/정기휴무는 회색 처리.
 *
 * 헌법 IV: 셀 데이터는 RPC가 user_id로 격리 — 이 컴포넌트는 표시 전용.
 */
export function CalendarGrid({
  year,
  month,
  cells,
  menuForecastByDate,
  selectedDate,
  todayIso,
  onSelect,
}: CalendarGridProps): React.ReactElement {
  const maxRevenue = Math.max(0, ...cells.map((c) => c.revenue ?? 0));
  // 1일 요일로 그리드 앞쪽 빈 칸 + 6주 42칸 고정 (월 길이 28~31에 따라 trailing blanks 자동).
  const leadingBlanks = new Date(year, month - 1, 1).getDay();
  const trailingBlanks = 42 - leadingBlanks - cells.length;

  return (
    <div className="glow-panel flex flex-col gap-stack-tight rounded-[28px] border border-border bg-card p-4 shadow-card">
      <WeekdayHeader />
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <BlankCell key={`lead-${i}`} />
        ))}
        {cells.map((cell) => (
          <DayCell
            key={cell.date}
            cell={cell}
            forecast={menuForecastByDate?.get(cell.date) ?? null}
            maxRevenue={maxRevenue}
            isSelected={cell.date === selectedDate}
            isToday={cell.date === todayIso}
            onSelect={onSelect}
          />
        ))}
        {Array.from({ length: trailingBlanks }, (_, i) => (
          <BlankCell key={`trail-${i}`} />
        ))}
      </div>
    </div>
  );
}

function WeekdayHeader(): React.ReactElement {
  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAY_KO.map((label, idx) => (
        <span key={label} className={cn("text-center text-micro", weekdayTone(idx, false))}>
          {label}
        </span>
      ))}
    </div>
  );
}

function BlankCell(): React.ReactElement {
  return <div className="min-h-20 rounded-2xl bg-bg sm:min-h-24" aria-hidden />;
}

interface DayCellProps {
  cell: EnrichedCalendarCell;
  forecast: CalendarMenuForecastSummary | null;
  maxRevenue: number;
  isSelected: boolean;
  isToday: boolean;
  onSelect: (cell: EnrichedCalendarCell) => void;
}

function DayCell({
  cell,
  forecast,
  maxRevenue,
  isSelected,
  isToday,
  onSelect,
}: DayCellProps): React.ReactElement {
  // RPC가 ISO를 보장하지만 parseLocalDateFromIso 시그니처가 nullable — 정상 경로 fallback.
  const date = parseLocalDateFromIso(cell.date) ?? new Date();
  const day = date.getDate();
  const weekday = date.getDay();
  const isInactive = cell.isFuture || cell.isBeforeSignup || cell.isRegularDayOff;
  const intensityPct = computeIntensityPercent(cell.revenue ?? 0, maxRevenue, isInactive);
  const status = getCellStatus(cell, forecast);

  return (
    <button
      type="button"
      aria-label={`${cell.date} ${cellAriaSummary(cell)}`}
      onClick={() => onSelect(cell)}
      className={cn(
        "relative flex min-h-20 flex-col justify-between rounded-2xl p-2 text-left transition-colors sm:min-h-24 sm:p-2.5",
        "shadow-soft hover:-translate-y-0.5 hover:shadow-card",
        isSelected ? "bg-ink-1 text-bg" : "text-ink-1",
        isToday && !isSelected && "border-2 border-blue ring-2 ring-blue/15",
        !isToday && "border border-white/70",
      )}
      style={
        isSelected
          ? undefined
          : { backgroundColor: `color-mix(in srgb, var(--ink-1) ${intensityPct}%, var(--card))` }
      }
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={cn(
            "text-body font-semibold tabular-nums sm:text-title-md",
            !isSelected && weekdayTone(weekday, isInactive),
          )}
        >
          {day}
        </span>
        <TopBadges cell={cell} />
      </div>

      {!isSelected && status && <CellStatusBadge status={status} />}
    </button>
  );
}

interface CellStatus {
  label: string;
  tone: "red" | "blue" | "ink";
}

function getCellStatus(
  cell: EnrichedCalendarCell,
  forecast: CalendarMenuForecastSummary | null,
): CellStatus | null {
  if (cell.isMissing) return { label: "누락", tone: "red" };
  if (cell.isFuture && forecast && forecast.totalRevenue > 0) {
    return {
      label: `예상 ${formatNumber(Math.round(forecast.totalRevenue / 10000))}만`,
      tone: "blue",
    };
  }
  if (cell.revenue !== null && cell.revenue > 0) {
    return { label: `${formatNumber(Math.round(cell.revenue / 10000))}만`, tone: "ink" };
  }
  return null;
}

function CellStatusBadge({ status }: { status: CellStatus }): React.ReactElement {
  return (
    <span
      className={cn(
        "w-fit rounded-full px-2 py-1 text-[10px] font-semibold leading-none shadow-soft sm:text-micro",
        status.tone === "red"
          ? "bg-red-soft text-red-deep"
          : status.tone === "blue"
            ? "bg-blue-soft text-blue-deep"
            : "bg-white/90 text-ink-1",
      )}
    >
      {status.label}
    </span>
  );
}

interface TopBadgesProps {
  cell: EnrichedCalendarCell;
}

function TopBadges({ cell }: TopBadgesProps): React.ReactElement | null {
  if (!cell.hasPurchase) return null;
  return (
    <span className="rounded-full bg-amber-soft px-1.5 py-0.5 text-[9px] font-semibold leading-none text-amber-deep shadow-soft">
      매입
    </span>
  );
}

function weekdayTone(weekday: number, isInactive: boolean): string {
  if (isInactive) return "text-ink-4";
  if (weekday === 0) return "text-red-deep";
  if (weekday === 6) return "text-blue-deep";
  return "text-ink-3";
}

function computeIntensityPercent(revenue: number, maxRevenue: number, isInactive: boolean): number {
  if (isInactive || revenue <= 0 || maxRevenue <= 0) return 0;
  const ratio = revenue / maxRevenue;
  const level = Math.min(INTENSITY_LEVELS, Math.max(1, Math.ceil(ratio * INTENSITY_LEVELS)));
  return level * INTENSITY_STEP_PCT;
}

function cellAriaSummary(cell: EnrichedCalendarCell): string {
  const parts: string[] = [];
  if (cell.isFuture) parts.push("미래일자");
  else if (cell.isBeforeSignup) parts.push("가입 전");
  else if (cell.isRegularDayOff) parts.push("정기휴무");
  else if (cell.isMissing) parts.push("판매 미입력");
  else if (cell.hasSale) parts.push("판매 입력 완료");
  else parts.push("데이터 없음");
  if (cell.hasPurchase) parts.push("매입 있음");
  return parts.join(", ");
}
