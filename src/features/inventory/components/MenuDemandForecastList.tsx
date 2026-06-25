"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatNumber, WEEKDAY_KO } from "@/lib/utils/format";
import type { MenuDemandForecastView } from "../hooks/useMenuDemandForecast";
import type { MenuForecastAccuracyView } from "../hooks/useMenuForecastAccuracy";

interface MenuDemandForecastListProps {
  items: readonly MenuDemandForecastView[];
  accuracyItems?: readonly MenuForecastAccuracyView[];
  variant?: "summary" | "detail";
}

const TREND_LABEL: Record<MenuDemandForecastView["trend"], string> = {
  rising: "판매 증가",
  falling: "판매 감소",
  normal: "보통",
};

const CONFIDENCE_LABEL: Record<MenuDemandForecastView["basis"]["confidenceLevel"], string> = {
  high: "신뢰도 높음",
  medium: "신뢰도 보통",
  low: "신뢰도 낮음",
  collecting: "데이터 수집 중",
};

export function MenuDemandForecastList({
  items,
  accuracyItems = [],
  variant = "detail",
}: MenuDemandForecastListProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <p className="glow-panel rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-3 shadow-soft">
        판매 이력이 있는 메뉴가 아직 없어요. 판매를 입력하면 메뉴별 예상 수요가 표시됩니다.
      </p>
    );
  }

  const accuracyByMenu = new Map(accuracyItems.map((accuracy) => [accuracy.menuId, accuracy]));

  return (
    <div className="flex flex-col gap-stack">
      {items.map((item) => (
        <MenuDemandForecastCard
          key={item.menuId}
          item={item}
          accuracy={accuracyByMenu.get(item.menuId)}
          variant={variant}
        />
      ))}
    </div>
  );
}

function MenuDemandForecastCard({
  item,
  accuracy,
  variant,
}: {
  item: MenuDemandForecastView;
  accuracy?: MenuForecastAccuracyView;
  variant: "summary" | "detail";
}): React.ReactElement {
  const maxDailyQuantity = Math.max(
    1,
    ...item.dailyPredictions.map((day) => day.predictedQuantity),
  );

  return (
    <article className="glow-panel rounded-[28px] border border-border bg-card px-tile py-stack shadow-card">
      <div className="flex items-start justify-between gap-stack">
        <div className="min-w-0">
          <h2 className="break-words text-title-md text-ink-1">{item.name}</h2>
          <p className="mt-1 text-caption text-ink-3">
            7일 예상 {formatQuantity(item.sevenDayTotalQuantity)} · 내일{" "}
            {formatQuantity(item.tomorrowQuantity)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <TrendBadge trend={item.trend} isColdStart={item.isColdStart} />
          <ConfidenceBadge level={item.basis.confidenceLevel} />
          {accuracy && <AccuracyBadge accuracy={accuracy} />}
        </div>
      </div>

      {variant === "detail" && (
        <p className="mt-stack-tight rounded-2xl border border-border bg-bg px-3 py-2 text-caption text-ink-3">
          {formatForecastBasis(item)}
        </p>
      )}

      <ol className="mt-stack grid grid-cols-7 gap-1.5">
        {item.dailyPredictions.map((day) => (
          <li key={day.date.toISOString()} className="flex min-w-0 flex-col items-center gap-1">
            <span className="text-micro text-ink-4">{formatShortDate(day.date)}</span>
            <div className="flex h-16 w-full items-end rounded-xl bg-blue-soft px-1">
              <div
                className="w-full rounded-lg bg-blue shadow-soft"
                style={{
                  height: `${Math.max(6, (day.predictedQuantity / maxDailyQuantity) * 100)}%`,
                }}
              />
            </div>
            <span className="text-micro text-ink-3 tabular-nums">
              {formatQuantity(day.predictedQuantity)}
            </span>
          </li>
        ))}
      </ol>

      {variant === "detail" && item.optionGroups.length > 0 && (
        <div className="mt-stack flex flex-col gap-stack-tight border-t border-border pt-stack-tight">
          <p className="text-caption font-semibold text-ink-2">옵션 선택률</p>
          {item.optionGroups.map((group) => (
            <OptionGroupSummary key={group.optionGroupId} group={group} />
          ))}
        </div>
      )}
    </article>
  );
}

function AccuracyBadge({ accuracy }: { accuracy: MenuForecastAccuracyView }): React.ReactElement {
  const label =
    accuracy.meanAbsoluteQuantityError === null || accuracy.evaluatedDayCount < 3
      ? "정확도 수집 중"
      : `평균 ${formatQuantity(accuracy.meanAbsoluteQuantityError)} 오차`;

  return (
    <Link
      href="/inventory/forecast-accuracy?tab=menu"
      className={cn(
        "rounded-full px-2 py-0.5 text-micro shadow-soft",
        accuracy.reliability === "good"
          ? "bg-blue-soft text-blue-deep"
          : accuracy.reliability === "watch"
            ? "bg-amber-soft text-amber-deep"
            : accuracy.reliability === "low"
              ? "bg-red-soft text-red-deep"
              : "bg-bg text-ink-3",
      )}
    >
      {label}
    </Link>
  );
}

function ConfidenceBadge({
  level,
}: {
  level: MenuDemandForecastView["basis"]["confidenceLevel"];
}): React.ReactElement {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-micro shadow-soft",
        level === "high"
          ? "bg-blue-soft text-blue-deep"
          : level === "medium"
            ? "bg-bg text-ink-3"
            : level === "low"
              ? "bg-amber-soft text-amber-deep"
              : "bg-bg text-ink-4",
      )}
    >
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}

function formatForecastBasis(item: MenuDemandForecastView): string {
  const weekdayConfidence = Math.round(item.basis.averageWeekdayConfidence * 100);
  if (item.isColdStart) {
    return `판매 데이터 ${item.basis.usableSampleCount}일 기반 · 가입 초기라 예측을 수집 중입니다.`;
  }
  return `판매 데이터 ${item.basis.usableSampleCount}일 기반 · 월~목/금/주말 그룹 평균에 개별요일 보정 ${weekdayConfidence}%를 섞어 계산합니다.`;
}

function OptionGroupSummary({
  group,
}: {
  group: MenuDemandForecastView["optionGroups"][number];
}): React.ReactElement {
  const label = group.selectionType === "single" ? "택1" : "추가";
  const visibleValues = group.values.slice(0, 4);

  return (
    <div className="rounded-2xl bg-bg px-3 py-3">
      <div className="flex items-center justify-between gap-stack-tight">
        <span className="text-caption text-ink-2">{group.name}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-micro text-ink-3 shadow-soft">
          {label}
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {visibleValues.map((value) => (
          <li key={value.optionValueId} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-caption text-ink-3">
              {value.name}
              {value.isDefault ? " · 기본" : ""}
            </span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-white shadow-soft">
              <div
                className="h-full rounded-full bg-blue"
                style={{ width: `${Math.min(100, Math.max(0, value.selectionRate * 100))}%` }}
              />
            </div>
            <span className="w-11 text-right text-caption text-ink-2 tabular-nums">
              {formatRate(value.selectionRate)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendBadge({
  trend,
  isColdStart,
}: {
  trend: MenuDemandForecastView["trend"];
  isColdStart: boolean;
}): React.ReactElement {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-micro shadow-soft",
        trend === "rising"
          ? "bg-red-soft text-red-deep"
          : trend === "falling"
            ? "bg-blue-soft text-blue-deep"
            : "bg-bg text-ink-3",
      )}
    >
      {isColdStart ? "데이터 수집 중" : TREND_LABEL[trend]}
    </span>
  );
}

function formatQuantity(value: number): string {
  return `${formatNumber(Number(value.toFixed(1)))}개`;
}

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAY_KO[date.getDay()]}`;
}
