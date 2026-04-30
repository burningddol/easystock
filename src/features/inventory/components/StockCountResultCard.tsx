"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatWon, formatNumber } from "@/lib/utils/format";
import { PrimaryButton } from "@/components/ui/primary-button";
import { trackEvent } from "@/lib/analytics/ga4";
import type { ApplyStockCountResult } from "@/lib/supabase/rpc";

interface StockCountResultCardProps {
  result: ApplyStockCountResult;
  onConfirm: () => void;
}

/**
 * 재고 실사 적용 후 손실액 + 항목별 차이 표시 (FR-017, FR-028).
 * 헌법 III: 단가 변경 없이 수량만 보정 — 표시 카피에 명시.
 */
export function StockCountResultCard({
  result,
  onConfirm,
}: StockCountResultCardProps): React.ReactElement {
  // FR-029 GA4: 손실액 표시 시점 발화 (마운트 직후 1회)
  useEffect(() => {
    trackEvent("weekly_loss_displayed", {
      loss_amount: result.weeklyLossAmount,
      item_count: result.itemDifferences.length,
    });
  }, [result]);

  const lossPositive = result.weeklyLossAmount > 0;

  return (
    <article className="flex flex-col gap-section">
      <header className="flex flex-col gap-stack rounded-lg border border-border bg-card p-tile">
        <span className="text-caption text-ink-3">실사 손실액</span>
        <span
          className={cn(
            "text-metric-hero tabular-nums",
            lossPositive ? "text-red-deep" : "text-ink-1",
          )}
        >
          {formatWon(result.weeklyLossAmount)}
          <span className="ml-1 text-caption text-ink-3">원</span>
        </span>
        <p className="text-caption text-ink-3">
          시스템 재고 - 실재고 차이 × 평균 단가. 단가는 그대로, 수량만 보정됩니다.
        </p>
      </header>

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {result.itemDifferences.map((d) => (
          <DifferenceRow key={d.ingredientId} item={d} />
        ))}
      </ul>

      <PrimaryButton type="button" onClick={onConfirm}>
        확인했어요
      </PrimaryButton>
    </article>
  );
}

interface DifferenceRowProps {
  item: ApplyStockCountResult["itemDifferences"][number];
}

function DifferenceRow({ item }: DifferenceRowProps): React.ReactElement {
  const tone = lossTone(item.lossAmount);
  const sign = lossSign(item.lossAmount);
  return (
    <li className="grid grid-cols-[1fr_auto_auto] items-baseline gap-stack px-tile py-stack">
      <span className="text-body-regular text-ink-1">{item.name}</span>
      <span className="text-caption text-ink-3 tabular-nums">
        {formatNumber(item.systemStock)} → {formatNumber(item.actualStock)}
      </span>
      <span className={cn("text-body-regular tabular-nums", tone)}>
        {sign}
        {formatWon(Math.abs(item.lossAmount))}원
      </span>
    </li>
  );
}

function lossTone(amount: number): string {
  if (amount > 0) return "text-red-deep";
  if (amount < 0) return "text-green-deep";
  return "text-ink-3";
}

function lossSign(amount: number): string {
  if (amount > 0) return "-";
  if (amount < 0) return "+";
  return "";
}
