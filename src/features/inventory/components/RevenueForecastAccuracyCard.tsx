"use client";

import { cn } from "@/lib/utils";
import { formatDateKoFromIso, formatWon, localIsoDate } from "@/lib/utils/format";
import type { RevenueForecastAccuracyView } from "../hooks/useRevenueForecastAccuracy";

interface RevenueForecastAccuracyCardProps {
  data: RevenueForecastAccuracyView;
}

const RELIABILITY_LABEL: Record<RevenueForecastAccuracyView["reliability"], string> = {
  good: "신뢰도 좋음",
  watch: "주의",
  low: "신뢰도 낮음",
  insufficient_data: "데이터 부족",
};

const BIAS_LABEL: Record<RevenueForecastAccuracyView["bias"], string> = {
  over: "과대예측",
  under: "과소예측",
  balanced: "균형",
  insufficient_data: "데이터 부족",
};

export function RevenueForecastAccuracyCard({
  data,
}: RevenueForecastAccuracyCardProps): React.ReactElement {
  const maxRevenue = Math.max(
    1,
    ...data.dailyResults.flatMap((day) => [day.actualRevenue, day.predictedRevenue]),
  );

  if (data.dailyResults.length === 0 || data.evaluatedDayCount === 0) {
    return (
      <p className="glow-panel rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-3 shadow-soft">
        아직 비교할 매출 이력이 없어요. 판매 데이터가 쌓이면 매출 예측 정확도를 확인할 수 있습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <section className="grid gap-stack-tight sm:grid-cols-4">
        <SummaryTile label="WAPE" value={formatPercent(data.weightedAbsolutePercentageError)} />
        <SummaryTile label="MAPE" value={formatPercent(data.meanAbsolutePercentageError)} />
        <SummaryTile label="평균 오차" value={`${formatWon(data.averageAbsoluteError ?? 0)}원`} />
        <SummaryTile label="비교일" value={`${data.evaluatedDayCount}일`} />
      </section>

      <article className="glow-panel rounded-[28px] border border-border bg-card px-tile py-stack shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-title-md text-ink-1">매출 예측 요약</h2>
            <p className="mt-1 text-caption text-ink-3">
              실제 {formatWon(data.actualTotalRevenue)}원 · 예측{" "}
              {formatWon(data.predictedTotalRevenue)}원
            </p>
          </div>
          <div className="flex flex-wrap gap-1 sm:justify-end">
            <ReliabilityBadge reliability={data.reliability} />
            <BiasBadge bias={data.bias} />
          </div>
        </div>

        <p className="mt-stack rounded-2xl border border-border bg-bg px-3 py-2 text-caption text-ink-3">
          WAPE는 전체 실제 매출 대비 총 오차입니다. 매출이 작은 날 하나에 흔들리는 MAPE보다 운영
          판단용으로 더 안정적입니다.
        </p>

        <ol className="mt-stack grid grid-cols-7 gap-1.5">
          {data.dailyResults.slice(-14).map((day) => (
            <li key={day.date.toISOString()} className="flex min-w-0 flex-col items-center gap-1">
              <span className="text-micro text-ink-4">{formatShortDate(day.date)}</span>
              <div className="flex h-16 w-full items-end justify-center gap-0.5 rounded-xl bg-bg px-1">
                <div
                  title="실제"
                  className="w-1/2 rounded-lg bg-blue shadow-soft"
                  style={{ height: `${barHeight(day.actualRevenue, maxRevenue)}%` }}
                />
                <div
                  title="예측"
                  className="w-1/2 rounded-lg bg-amber shadow-soft"
                  style={{ height: `${barHeight(day.predictedRevenue, maxRevenue)}%` }}
                />
              </div>
              <span className="text-micro text-ink-3 tabular-nums">
                {formatPercent(day.absolutePercentageError)}
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

      <ul className="flex flex-col gap-stack-tight">
        {data.dailyResults
          .filter((day) => day.actualRevenue > 0)
          .slice(-7)
          .map((day) => (
            <li
              key={day.date.toISOString()}
              className="rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-body font-semibold text-ink-1">
                    {formatDateKoFromIso(localIsoDate(day.date))}
                  </p>
                  <p className="text-caption text-ink-3">
                    실제 {formatWon(day.actualRevenue)}원 · 예측 {formatWon(day.predictedRevenue)}원
                  </p>
                </div>
                <span className="rounded-full bg-bg px-3 py-1.5 text-caption font-semibold text-ink-2">
                  오차 {formatWon(day.absoluteError)}원 ·{" "}
                  {formatPercent(day.absolutePercentageError)}
                </span>
              </div>
            </li>
          ))}
      </ul>
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

function ReliabilityBadge({
  reliability,
}: {
  reliability: RevenueForecastAccuracyView["reliability"];
}): React.ReactElement {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-micro shadow-soft",
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

function BiasBadge({ bias }: { bias: RevenueForecastAccuracyView["bias"] }): React.ReactElement {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-micro shadow-soft",
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

function barHeight(value: number, maxRevenue: number): number {
  if (value <= 0) return 4;
  return Math.max(6, (value / maxRevenue) * 100);
}

function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return `${Math.round(value * 100)}%`;
}

function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
