"use client";

import { cn } from "@/lib/utils";
import { formatNumber, WEEKDAY_KO } from "@/lib/utils/format";
import type { MenuForecastAccuracyView } from "../hooks/useMenuForecastAccuracy";

interface MenuForecastAccuracyListProps {
  items: readonly MenuForecastAccuracyView[];
}

const BIAS_LABEL: Record<MenuForecastAccuracyView["bias"], string> = {
  over: "과대예측",
  under: "과소예측",
  balanced: "균형",
  insufficient_data: "데이터 부족",
};

const RELIABILITY_LABEL: Record<MenuForecastAccuracyView["reliability"], string> = {
  good: "신뢰도 좋음",
  watch: "주의",
  low: "신뢰도 낮음",
  insufficient_data: "데이터 부족",
};

export function MenuForecastAccuracyList({
  items,
}: MenuForecastAccuracyListProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <p className="glow-panel rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-3 shadow-soft">
        아직 비교할 판매 이력이 없어요. 판매 데이터가 쌓이면 예측 정확도를 확인할 수 있습니다.
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

      <PriorityNotice item={summary.priorityItem} />

      <div className="flex flex-col gap-stack">
        {items.map((item) => (
          <MenuForecastAccuracyCard key={item.menuId} item={item} />
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

function MenuForecastAccuracyCard({
  item,
}: {
  item: MenuForecastAccuracyView;
}): React.ReactElement {
  const maxQuantity = Math.max(
    1,
    ...item.dailyResults.flatMap((day) => [day.actualQuantity, day.predictedQuantity]),
  );

  return (
    <article className="glow-panel rounded-[28px] border border-border bg-card px-tile py-stack shadow-card">
      <div className="flex items-start justify-between gap-stack">
        <div className="min-w-0">
          <h2 className="break-words text-title-md text-ink-1">{item.name}</h2>
          <p className="mt-1 text-caption text-ink-3">
            실제 {formatQuantity(item.actualTotalQuantity)} · 예측{" "}
            {formatQuantity(item.predictedTotalQuantity)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ReliabilityBadge reliability={item.reliability} />
          <BiasBadge bias={item.bias} />
        </div>
      </div>

      <dl className="mt-stack grid grid-cols-3 gap-stack-tight">
        <Metric label="오차율" value={formatPercent(item.meanAbsolutePercentageError)} />
        <Metric label="평균 오차" value={formatNullableQuantity(item.averageAbsoluteError)} />
        <Metric label="비교일" value={`${item.evaluatedDayCount}일`} />
      </dl>

      <TuningHint item={item} />

      <ol className="mt-stack grid grid-cols-7 gap-1.5">
        {item.dailyResults.slice(-7).map((day) => (
          <li key={day.date.toISOString()} className="flex min-w-0 flex-col items-center gap-1">
            <span className="text-micro text-ink-4">{formatShortDate(day.date)}</span>
            <div className="flex h-16 w-full items-end justify-center gap-0.5 rounded-xl bg-bg px-1">
              <div
                title="실제"
                className="w-1/2 rounded-lg bg-blue shadow-soft"
                style={{ height: `${barHeight(day.actualQuantity, maxQuantity)}%` }}
              />
              <div
                title="예측"
                className="w-1/2 rounded-lg bg-amber shadow-soft"
                style={{ height: `${barHeight(day.predictedQuantity, maxQuantity)}%` }}
              />
            </div>
            <span className="text-micro text-ink-3 tabular-nums">
              {formatQuantity(day.actualQuantity)}
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

function BiasBadge({ bias }: { bias: MenuForecastAccuracyView["bias"] }): React.ReactElement {
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

function ReliabilityBadge({
  reliability,
}: {
  reliability: MenuForecastAccuracyView["reliability"];
}): React.ReactElement {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-micro shadow-soft",
        reliability === "good"
          ? "bg-blue-soft text-blue-deep"
          : reliability === "watch"
            ? "bg-amber-soft text-amber-deep"
            : reliability === "low"
              ? "bg-red-soft text-red-deep"
              : "bg-bg text-ink-3",
      )}
    >
      {RELIABILITY_LABEL[reliability]}
    </span>
  );
}

function PriorityNotice({
  item,
}: {
  item: MenuForecastAccuracyView | null;
}): React.ReactElement | null {
  if (!item || item.meanAbsolutePercentageError === null) return null;

  return (
    <section className="rounded-[24px] border border-amber/30 bg-amber-soft px-4 py-3 shadow-soft">
      <p className="text-body text-amber-deep">
        우선 확인: {item.name} · 오차율 {formatPercent(item.meanAbsolutePercentageError)}
      </p>
      <p className="mt-1 text-caption text-ink-3">{buildTuningHint(item)}</p>
    </section>
  );
}

function TuningHint({ item }: { item: MenuForecastAccuracyView }): React.ReactElement {
  return (
    <p className="mt-stack rounded-2xl border border-border bg-bg px-3 py-2 text-caption text-ink-3">
      {buildTuningHint(item)}
    </p>
  );
}

function buildSummary(items: readonly MenuForecastAccuracyView[]): {
  meanMape: number | null;
  overCount: number;
  underCount: number;
  priorityItem: MenuForecastAccuracyView | null;
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
    priorityItem:
      valid.length > 0
        ? ([...valid].sort(
            (a, b) => (b.meanAbsolutePercentageError ?? 0) - (a.meanAbsolutePercentageError ?? 0),
          )[0] ?? null)
        : null,
  };
}

function buildTuningHint(item: MenuForecastAccuracyView): string {
  if (item.evaluatedDayCount < 3) return "판매 비교일이 적습니다. 데이터가 더 쌓인 뒤 판단하세요.";
  if (item.reliability === "low")
    return "오차율이 매우 큽니다. 이벤트성 판매, 메뉴 옵션, 최근 레시피 변경을 먼저 확인하세요.";
  if (item.reliability === "watch")
    return "예측을 참고하되 발주 전 최근 1주 판매 흐름을 한 번 더 확인하세요.";
  if (item.bias === "under")
    return "실제 판매가 예측보다 많습니다. 발주량 부족 위험을 먼저 확인하세요.";
  if (item.bias === "over")
    return "예측이 실제보다 큽니다. 과발주 가능성이 있어 최근 판매 둔화를 확인하세요.";
  if ((item.meanAbsolutePercentageError ?? 0) >= 0.5) {
    return "오차율이 큽니다. 주말/평일 편차나 최근 이벤트성 판매를 확인하세요.";
  }
  return "예측 방향은 안정적입니다. 큰 조정 없이 추이를 계속 보세요.";
}

function barHeight(value: number, maxQuantity: number): number {
  if (value <= 0) return 4;
  return Math.max(6, (value / maxQuantity) * 100);
}

function formatQuantity(value: number): string {
  return `${formatNumber(Number(value.toFixed(1)))}개`;
}

function formatNullableQuantity(value: number | null): string {
  return value === null ? "-" : formatQuantity(value);
}

function formatPercent(value: number | null): string {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
}

function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAY_KO[date.getDay()]}`;
}
