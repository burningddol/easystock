"use client";

import { cn } from "@/lib/utils";
import { formatWon, weekdayKoFromIso } from "@/lib/utils/format";
import type { DashboardYesterday, DashboardWeeklyChartPoint } from "@/lib/supabase/rpc";

interface YesterdayKpiCardProps {
  yesterday: DashboardYesterday;
  weeklyChart: readonly DashboardWeeklyChartPoint[];
}

/**
 * 어제 KPI Hero 카드 (patterns.md "홈" 위계 #2).
 * - 매출 hero + 지난주 같은 요일 比 chip (FR-020)
 * - 순수익 / 마진율 분리 표시 + "재료 원가 기준 (이동평균법)" 라벨 (FR-019)
 * - 7일 미니 막대 차트 (어제만 ink-1, 나머지 ink-4)
 */
export function YesterdayKpiCard({
  yesterday,
  weeklyChart,
}: YesterdayKpiCardProps): React.ReactElement {
  const hasRevenue = yesterday.revenue > 0;
  const maxRevenue = Math.max(...weeklyChart.map((p) => p.revenue), 1);

  return (
    <article className="flex flex-col gap-stack rounded-xl border border-border bg-card p-tile">
      <header className="flex items-baseline justify-between">
        <span className="text-caption text-ink-3">어제 매출</span>
        <ChangeChip value={yesterday.revenueChangePercent} />
      </header>

      <div className="text-metric-hero tabular-nums text-ink-1">
        {formatWon(yesterday.revenue)}
        <span className="ml-1 text-caption text-ink-3">원</span>
      </div>

      <div className="grid grid-cols-2 gap-stack border-t border-border pt-stack">
        <KpiSlot label="순수익" value={hasRevenue ? `${formatWon(yesterday.netProfit)}원` : "—"} />
        <KpiSlot
          label="마진율"
          value={hasRevenue ? `${yesterday.marginPercent.toFixed(1)}%` : "—"}
        />
      </div>

      <p className="text-micro text-ink-3">재료 원가 기준 (이동평균법)</p>

      <WeeklyMiniChart data={weeklyChart} maxRevenue={maxRevenue} highlightKey={yesterday.soldAt} />
    </article>
  );
}

interface KpiSlotProps {
  label: string;
  value: string;
}

function KpiSlot({ label, value }: KpiSlotProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-micro text-ink-3">{label}</span>
      <span className="text-metric-md tabular-nums text-ink-1">{value}</span>
    </div>
  );
}

interface ChangeChipProps {
  value: number | null;
}

function ChangeChip({ value }: ChangeChipProps): React.ReactElement | null {
  if (value === null) {
    return <span className="text-micro text-ink-3">지난주 데이터 없음</span>;
  }
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-micro tabular-nums",
        isPositive ? "bg-green-soft text-green-deep" : "bg-red-soft text-red-deep",
      )}
    >
      지난주 比 {isPositive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

interface WeeklyMiniChartProps {
  data: readonly DashboardWeeklyChartPoint[];
  maxRevenue: number;
  highlightKey: string;
}

function WeeklyMiniChart({
  data,
  maxRevenue,
  highlightKey,
}: WeeklyMiniChartProps): React.ReactElement {
  return (
    <div className="flex items-end gap-1 pt-stack-tight" aria-label="지난 7일 매출 차트">
      {data.map((p) => {
        const heightPct = (p.revenue / maxRevenue) * 100;
        const isYesterday = p.soldAt === highlightKey;
        const day = weekdayKoFromIso(p.soldAt);
        return (
          <div key={p.soldAt} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-10 w-full items-end">
              <div
                className={cn("w-full rounded-sm", isYesterday ? "bg-ink-1" : "bg-ink-4")}
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              />
            </div>
            <span
              className={cn(
                "text-micro tabular-nums",
                isYesterday ? "font-bold text-ink-1" : "text-ink-3",
              )}
            >
              {day}
            </span>
          </div>
        );
      })}
    </div>
  );
}
