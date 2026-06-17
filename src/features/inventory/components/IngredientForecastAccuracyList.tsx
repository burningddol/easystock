"use client";

import { cn } from "@/lib/utils";
import { formatNumber, WEEKDAY_KO } from "@/lib/utils/format";
import type { IngredientForecastAccuracyView } from "../hooks/useIngredientForecastAccuracy";

interface IngredientForecastAccuracyListProps {
  items: readonly IngredientForecastAccuracyView[];
}

const BIAS_LABEL: Record<IngredientForecastAccuracyView["bias"], string> = {
  over: "과대예측",
  under: "과소예측",
  balanced: "균형",
  insufficient_data: "데이터 부족",
};

export function IngredientForecastAccuracyList({
  items,
}: IngredientForecastAccuracyListProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <p className="glow-panel rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-3 shadow-soft">
        아직 비교할 재료 사용 이력이 없어요. 판매 데이터가 쌓이면 재료 예측 정확도를 확인할 수
        있습니다.
      </p>
    );
  }

  const summary = buildSummary(items);

  return (
    <div className="flex flex-col gap-section">
      <section className="grid grid-cols-3 gap-stack-tight">
        <SummaryTile label="평균 오차율" value={formatPercent(summary.meanMape)} />
        <SummaryTile label="과대예측" value={`${summary.overCount}개`} />
        <SummaryTile label="과소예측" value={`${summary.underCount}개`} />
      </section>

      <div className="flex flex-col gap-stack">
        {items.map((item) => (
          <IngredientForecastAccuracyCard key={item.ingredientId} item={item} />
        ))}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-3 text-center shadow-soft">
      <p className="text-micro text-ink-4">{label}</p>
      <p className="mt-1 text-title-md text-ink-1">{value}</p>
    </div>
  );
}

function IngredientForecastAccuracyCard({
  item,
}: {
  item: IngredientForecastAccuracyView;
}): React.ReactElement {
  const maxAmount = Math.max(
    1,
    ...item.dailyResults.flatMap((day) => [day.actualAmount, day.predictedAmount]),
  );

  return (
    <article className="glow-panel rounded-[28px] border border-border bg-card px-tile py-stack shadow-card">
      <div className="flex items-start justify-between gap-stack">
        <div className="min-w-0">
          <h2 className="break-words text-title-md text-ink-1">{item.name}</h2>
          <p className="mt-1 text-caption text-ink-3">
            실제 {formatAmount(item.actualTotalAmount, item.unit)} · 예측{" "}
            {formatAmount(item.predictedTotalAmount, item.unit)}
          </p>
        </div>
        <BiasBadge bias={item.bias} />
      </div>

      <dl className="mt-stack grid grid-cols-3 gap-stack-tight">
        <Metric label="오차율" value={formatPercent(item.meanAbsolutePercentageError)} />
        <Metric
          label="평균 오차"
          value={formatNullableAmount(item.averageAbsoluteError, item.unit)}
        />
        <Metric label="비교일" value={`${item.evaluatedDayCount}일`} />
      </dl>

      <ol className="mt-stack grid grid-cols-7 gap-1.5">
        {item.dailyResults.slice(-7).map((day) => (
          <li key={day.date.toISOString()} className="flex min-w-0 flex-col items-center gap-1">
            <span className="text-micro text-ink-4">{formatShortDate(day.date)}</span>
            <div className="flex h-16 w-full items-end justify-center gap-0.5 rounded-xl bg-bg px-1">
              <div
                title="실제"
                className="w-1/2 rounded-lg bg-blue shadow-soft"
                style={{ height: `${barHeight(day.actualAmount, maxAmount)}%` }}
              />
              <div
                title="예측"
                className="w-1/2 rounded-lg bg-amber shadow-soft"
                style={{ height: `${barHeight(day.predictedAmount, maxAmount)}%` }}
              />
            </div>
            <span className="text-micro text-ink-3 tabular-nums">
              {formatAmount(day.actualAmount, item.unit)}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-stack flex items-center gap-3 text-micro text-ink-3">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue" />
          실제
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber" />
          예측
        </span>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-2xl bg-bg px-3 py-3">
      <dt className="text-micro text-ink-4">{label}</dt>
      <dd className="mt-1 text-body text-ink-1">{value}</dd>
    </div>
  );
}

function BiasBadge({ bias }: { bias: IngredientForecastAccuracyView["bias"] }): React.ReactElement {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-micro shadow-soft",
        bias === "over"
          ? "bg-red-soft text-red-deep"
          : bias === "under"
            ? "bg-amber-soft text-amber-deep"
            : bias === "balanced"
              ? "bg-blue-soft text-blue-deep"
              : "bg-bg text-ink-3",
      )}
    >
      {BIAS_LABEL[bias]}
    </span>
  );
}

function buildSummary(items: readonly IngredientForecastAccuracyView[]): {
  meanMape: number | null;
  overCount: number;
  underCount: number;
} {
  const valid = items.filter((item) => item.meanAbsolutePercentageError !== null);
  return {
    meanMape:
      valid.length > 0
        ? valid.reduce((sum, item) => sum + (item.meanAbsolutePercentageError ?? 0), 0) /
          valid.length
        : null,
    overCount: items.filter((item) => item.bias === "over").length,
    underCount: items.filter((item) => item.bias === "under").length,
  };
}

function barHeight(value: number, maxAmount: number): number {
  if (value <= 0) return 4;
  return Math.max(6, (value / maxAmount) * 100);
}

function formatAmount(value: number, unit: IngredientForecastAccuracyView["unit"]): string {
  return `${formatNumber(Number(value.toFixed(1)))}${unit}`;
}

function formatNullableAmount(
  value: number | null,
  unit: IngredientForecastAccuracyView["unit"],
): string {
  return value === null ? "-" : formatAmount(value, unit);
}

function formatPercent(value: number | null): string {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
}

function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAY_KO[date.getDay()]}`;
}
