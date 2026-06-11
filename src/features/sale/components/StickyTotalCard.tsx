"use client";

import { MARGIN_LABEL } from "@/lib/domain/margin";
import { formatWon } from "@/lib/utils/format";
import type { SaleSnapshotPreview } from "@/lib/domain/snapshot";

interface StickyTotalCardProps {
  preview: SaleSnapshotPreview;
}

export function StickyTotalCard({ preview }: StickyTotalCardProps): React.ReactElement {
  const revenue = preview.totalRevenue.toNumber();
  const cost = preview.totalCost.toNumber();
  const profit = preview.totalNetProfit.toNumber();
  const rate = preview.marginRate.toNumber();

  return (
    <div className="mt-2">
      <div className="glow-panel mx-auto max-w-screen-md rounded-[28px] border border-white/80 bg-white/95 px-5 py-4 shadow-card backdrop-blur">
        <div className="grid grid-cols-3 items-end gap-stack">
          <Metric label="매출" value={formatWon(revenue)} accent />
          <Metric label="원가" value={formatWon(cost)} />
          <Metric label="순수익" value={formatWon(profit)} accent />
        </div>
        <p className="mt-stack-tight flex items-baseline justify-between text-caption text-ink-3">
          <span>{MARGIN_LABEL}</span>
          <span className="text-ink-2 tabular-nums">마진 {rate.toFixed(0)}%</span>
        </p>
      </div>
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string;
  accent?: boolean;
}

function Metric({ label, value, accent }: MetricProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-ink-3">{label}</span>
      <span
        className={
          accent
            ? "text-metric-md font-semibold text-brand-primary tabular-nums"
            : "text-body font-medium text-ink-2 tabular-nums"
        }
      >
        {value}
        <span className="ml-0.5 text-caption text-ink-3">원</span>
      </span>
    </div>
  );
}
