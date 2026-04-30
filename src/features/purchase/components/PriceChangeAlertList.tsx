"use client";

import { cn } from "@/lib/utils";
import { formatWon } from "@/lib/utils/format";
import type { PriceChangeAlert } from "@/lib/supabase/rpc";

interface PriceChangeAlertListProps {
  alerts: readonly PriceChangeAlert[];
}

/**
 * ±5% 변동 알림 (FR-005). 매입 저장 직후 표시.
 * 인상은 red soft, 인하는 green soft 톤.
 */
export function PriceChangeAlertList({
  alerts,
}: PriceChangeAlertListProps): React.ReactElement | null {
  if (alerts.length === 0) return null;

  return (
    <section className="flex flex-col gap-stack-tight">
      <h3 className="text-title-md text-ink-1">단가 변동 알림</h3>
      <ul className="flex flex-col gap-stack-tight">
        {alerts.map((alert) => (
          <AlertRow key={alert.ingredientId} alert={alert} />
        ))}
      </ul>
    </section>
  );
}

function AlertRow({ alert }: { alert: PriceChangeAlert }): React.ReactElement {
  const isIncrease = alert.changePercent > 0;
  const sign = isIncrease ? "+" : "";

  return (
    <li
      className={cn(
        "flex flex-col gap-1 rounded-lg p-tile",
        isIncrease ? "bg-red-soft" : "bg-green-soft",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className={cn("text-body", isIncrease ? "text-red-deep" : "text-green-deep")}>
          {alert.ingredientName} 단가 {sign}
          {alert.changePercent.toFixed(0)}%
        </span>
        <span
          className={cn(
            "text-caption tabular-nums",
            isIncrease ? "text-red-deep" : "text-green-deep",
          )}
        >
          {formatWon(alert.previousAvgPrice)} → {formatWon(alert.newAvgPrice)}원
        </span>
      </div>
      <p className="text-caption text-ink-3">
        {isIncrease
          ? "메뉴 마진율이 떨어질 수 있어요. 메뉴 화면에서 영향 확인하세요."
          : "메뉴 마진율이 올라갑니다."}
      </p>
    </li>
  );
}
