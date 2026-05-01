"use client";

import { Metric } from "@/components/ui/metric";
import { formatWon, formatNumber } from "@/lib/utils/format";
import type { CalendarCumulative } from "@/lib/supabase/rpc";

interface MonthCumulativeCardProps {
  cumulative: CalendarCumulative;
  marginLabel: string;
}

/**
 * 월간 누적 KPI 카드 (patterns.md "캘린더" 위계 #2).
 * 매출 / 순수익 / 일평균 / 영업일수 — "재료 원가 기준 (이동평균법)" 라벨 (FR-019).
 */
export function MonthCumulativeCard({
  cumulative,
  marginLabel,
}: MonthCumulativeCardProps): React.ReactElement {
  return (
    <article className="flex flex-col gap-stack rounded-xl border border-border bg-card p-tile">
      <div className="grid grid-cols-2 gap-stack">
        <Metric label="총 매출" value={`${formatWon(cumulative.totalRevenue)}원`} />
        <Metric label="순수익" value={`${formatWon(cumulative.totalNetProfit)}원`} />
        <Metric
          label="일평균 매출"
          value={cumulative.operatingDays > 0 ? `${formatWon(cumulative.avgDailyRevenue)}원` : "—"}
        />
        <Metric label="영업일수" value={`${formatNumber(cumulative.operatingDays)}일`} />
      </div>
      <p className="text-micro text-ink-3">{marginLabel}</p>
    </article>
  );
}
