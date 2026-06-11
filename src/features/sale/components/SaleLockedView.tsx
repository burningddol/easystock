"use client";

import { MARGIN_LABEL } from "@/lib/domain/margin";
import { formatWon } from "@/lib/utils/format";
import type { SaleWithItems } from "../hooks/useSaleByDate";

interface SaleLockedViewProps {
  sale: SaleWithItems;
}

/** FR-030: 저장 후 7일이 지난 sale은 편집/삭제 불가. 요약만 read-only로 표시. */
export function SaleLockedView({ sale }: SaleLockedViewProps): React.ReactElement {
  return (
    <article className="glow-panel flex flex-col gap-stack rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-card">
      <div className="rounded-[24px] bg-amber-50 px-4 py-3 text-body-regular text-amber-700">
        저장 후 7일이 지나 수정할 수 없습니다. 기록은 보존됩니다.
      </div>
      <ul className="flex flex-col gap-3 text-body-regular text-ink-2 tabular-nums">
        <li className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
          <span>매출</span>
          <span>{formatWon(sale.total_revenue)}원</span>
        </li>
        <li className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
          <span>원가</span>
          <span>{formatWon(sale.total_cost_snapshot)}원</span>
        </li>
        <li className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
          <span>순수익</span>
          <span>{formatWon(sale.total_revenue - sale.total_cost_snapshot)}원</span>
        </li>
      </ul>
      <p className="text-micro text-ink-3">{MARGIN_LABEL}</p>
    </article>
  );
}
