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
      <section className="flex flex-col gap-2">
        <h3 className="text-caption font-semibold text-ink-2">판매 항목</h3>
        <ul className="flex flex-col gap-3">
          {sale.items.map((item) => (
            <li key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-body-regular text-ink-1">
                <span>{item.menu_name ?? "알 수 없는 메뉴"}</span>
                <span className="tabular-nums">{item.quantity}개</span>
              </div>
              {item.options.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-caption text-ink-3">
                  {item.options.map((option) => (
                    <li key={option.id} className="flex justify-between gap-3">
                      <span>
                        {option.group_name_snapshot} · {option.value_name_snapshot}
                      </span>
                      <span className="tabular-nums">
                        +{formatWon(option.price_delta_snapshot)}원
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
      <p className="text-micro text-ink-3">{MARGIN_LABEL}</p>
    </article>
  );
}
