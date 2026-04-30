"use client";

import { MARGIN_LABEL } from "@/lib/domain/margin";
import type { SaleSnapshotPreview } from "@/lib/domain/snapshot";

interface StickyTotalCardProps {
  preview: SaleSnapshotPreview;
}

const fmt = (n: number): string => Math.round(n).toLocaleString("ko-KR");

export function StickyTotalCard({ preview }: StickyTotalCardProps): React.ReactElement {
  const revenue = preview.totalRevenue.toNumber();
  const cost = preview.totalCost.toNumber();
  const profit = preview.totalNetProfit.toNumber();
  const rate = preview.marginRate.toNumber();

  return (
    <div className="sticky bottom-20 z-30 mx-[-16px] border-t border-border bg-card px-screen py-stack">
      <div className="grid grid-cols-3 items-end gap-stack">
        <Metric label="매출" value={fmt(revenue)} accent />
        <Metric label="원가" value={fmt(cost)} />
        <Metric label="순수익" value={fmt(profit)} accent />
      </div>
      <p className="mt-stack-tight flex items-baseline justify-between text-caption text-ink-3">
        <span>{MARGIN_LABEL}</span>
        <span className="text-ink-2 tabular-nums">마진 {rate.toFixed(0)}%</span>
      </p>
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
          accent ? "text-metric-md text-ink-1 tabular-nums" : "text-body text-ink-2 tabular-nums"
        }
      >
        {value}
        <span className="ml-0.5 text-caption text-ink-3">원</span>
      </span>
    </div>
  );
}
