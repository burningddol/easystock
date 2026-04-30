"use client";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import type { DashboardLowMarginMenu, DashboardTopMenu } from "@/lib/supabase/rpc";

interface MarginTop3CardProps {
  top3: readonly DashboardTopMenu[];
  lowMargin: DashboardLowMarginMenu | null;
}

/**
 * 이번 주 메뉴 마진 TOP 3 + 마진 하락 메뉴 1개 (patterns.md "홈" 위계 #4-5).
 * 헌법 III: sale_items.menu_cost_snapshot 스냅샷 기반이므로 과거 마진 영구 불변.
 */
export function MarginTop3Card({
  top3,
  lowMargin,
}: MarginTop3CardProps): React.ReactElement | null {
  if (top3.length === 0 && !lowMargin) return null;

  return (
    <section className="flex flex-col gap-stack">
      {top3.length > 0 && (
        <div className="flex flex-col gap-stack-tight">
          <h2 className="text-label text-ink-3">이번 주 마진 TOP 3</h2>
          <ul className="rounded-xl border border-border bg-card">
            {top3.map((menu, idx) => (
              <TopRow
                key={menu.menuId}
                rank={idx + 1}
                menu={menu}
                isLast={idx === top3.length - 1}
              />
            ))}
          </ul>
          <p className="text-micro text-ink-3">재료 원가 기준 (이동평균법)</p>
        </div>
      )}

      {lowMargin && <LowMarginAlert menu={lowMargin} />}
    </section>
  );
}

interface TopRowProps {
  rank: number;
  menu: DashboardTopMenu;
  isLast: boolean;
}

function TopRow({ rank, menu, isLast }: TopRowProps): React.ReactElement {
  const tone = marginTone(menu.marginPercent);
  return (
    <li
      className={cn(
        "flex items-center gap-stack px-tile py-stack",
        !isLast && "border-b border-border",
      )}
    >
      <span className="w-5 text-micro tabular-nums text-ink-3">{rank}</span>
      <span className="flex-1 text-body text-ink-1">{menu.name}</span>
      <span className="text-caption tabular-nums text-ink-3">{formatNumber(menu.unitsSold)}잔</span>
      <span className={cn("min-w-12 text-right text-metric-md tabular-nums", tone)}>
        {menu.marginPercent.toFixed(0)}%
      </span>
    </li>
  );
}

interface LowMarginAlertProps {
  menu: DashboardLowMarginMenu;
}

function LowMarginAlert({ menu }: LowMarginAlertProps): React.ReactElement {
  return (
    <div className="flex items-start gap-stack-tight rounded-xl bg-red-soft p-tile">
      <div className="flex-1">
        <div className="text-body text-red-deep">
          {menu.name} 마진 {menu.marginPercent.toFixed(0)}%로 하락
        </div>
        {menu.cause && <div className="text-caption text-red-deep opacity-85">{menu.cause}</div>}
      </div>
    </div>
  );
}

function marginTone(margin: number): string {
  if (margin >= 50) return "text-green-deep";
  if (margin >= 30) return "text-amber-deep";
  return "text-red-deep";
}
