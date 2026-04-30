"use client";

import { cn } from "@/lib/utils";
import { daysUntilDate, formatNumber } from "@/lib/utils/format";
import type { DepletionStatus } from "@/lib/domain/forecast";
import type { IngredientForecastView } from "../hooks/useDepletionForecast";

interface IngredientStatusListProps {
  items: readonly IngredientForecastView[];
}

const STATUS_GROUP_ORDER: readonly DepletionStatus[] = [
  "critical",
  "order_needed",
  "caution",
  "safe",
];

const STATUS_LABEL: Record<DepletionStatus, string> = {
  critical: "🔴 발주 필요 (긴급)",
  order_needed: "🟠 발주 권장",
  caution: "🟡 주의",
  safe: "🟢 안전",
};

export function IngredientStatusList({ items }: IngredientStatusListProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <p className="text-body-regular text-ink-3">
        등록된 재료가 없어요. 매입을 등록하면 여기에 표시됩니다.
      </p>
    );
  }

  const grouped = new Map<DepletionStatus, IngredientForecastView[]>();
  for (const item of items) {
    const list = grouped.get(item.status) ?? [];
    list.push(item);
    grouped.set(item.status, list);
  }

  return (
    <div className="flex flex-col gap-section">
      {STATUS_GROUP_ORDER.map((status) => {
        const list = grouped.get(status);
        if (!list || list.length === 0) return null;
        return (
          <section key={status} className="flex flex-col gap-stack-tight">
            <h2 className="text-title-md text-ink-1">{STATUS_LABEL[status]}</h2>
            <ul className="flex flex-col gap-stack-tight">
              {list.map((item) => (
                <IngredientRow key={item.ingredientId} item={item} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function IngredientRow({ item }: { item: IngredientForecastView }): React.ReactElement {
  const depletionLabel = formatDepletion(item);
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-card px-tile py-stack">
      <div className="flex flex-col gap-1">
        <span className="text-body text-ink-1">{item.name}</span>
        <span className="text-caption text-ink-3 tabular-nums">
          현재 {formatNumber(item.currentStock)}
          {item.unit}
          <span className="text-ink-4"> · </span>
          리드타임 {item.leadTimeDays}일
        </span>
      </div>
      <div className="flex flex-col items-end gap-1 text-caption tabular-nums">
        <span className={cn(toneClass(item.status))}>{depletionLabel}</span>
        {item.trend !== "normal" && <TrendBadge trend={item.trend} />}
      </div>
    </li>
  );
}

function toneClass(status: DepletionStatus): string {
  if (status === "critical") return "text-red-deep";
  if (status === "order_needed") return "text-amber-deep";
  if (status === "caution") return "text-amber-deep";
  return "text-ink-3";
}

function formatDepletion(item: IngredientForecastView): string {
  const days = daysUntilDate(item.expectedDepletionDate);
  if (days === null) return "예측 데이터 부족";
  if (days === 0) return "오늘 소진";
  return `${days}일 후 소진`;
}

function TrendBadge({ trend }: { trend: "rising" | "falling" }): React.ReactElement {
  const isRising = trend === "rising";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-micro",
        isRising ? "bg-red-soft text-red-deep" : "bg-blue-soft text-blue-deep",
      )}
    >
      {isRising ? "사용량 증가" : "사용량 감소"}
    </span>
  );
}
