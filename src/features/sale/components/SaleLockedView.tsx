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
    <article className="flex flex-col gap-stack rounded-lg border border-border bg-card p-tile">
      <div className="rounded-md bg-amber-soft p-stack text-body-regular text-amber-deep">
        저장 후 7일이 지나 수정할 수 없습니다. 기록은 보존됩니다.
      </div>
      <ul className="flex flex-col gap-1 text-body-regular text-ink-2 tabular-nums">
        <li className="flex justify-between">
          <span>매출</span>
          <span>{formatWon(sale.total_revenue)}원</span>
        </li>
        <li className="flex justify-between">
          <span>원가</span>
          <span>{formatWon(sale.total_cost_snapshot)}원</span>
        </li>
        <li className="flex justify-between">
          <span>순수익</span>
          <span>{formatWon(sale.total_revenue - sale.total_cost_snapshot)}원</span>
        </li>
      </ul>
      <p className="text-micro text-ink-3">{MARGIN_LABEL}</p>
    </article>
  );
}
