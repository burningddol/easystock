"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ForecastPeriodSelector } from "@/features/inventory/components/ForecastPeriodSelector";
import { IngredientStatusList } from "@/features/inventory/components/IngredientStatusList";
import { MenuDemandForecastList } from "@/features/inventory/components/MenuDemandForecastList";
import { useDepletionForecast } from "@/features/inventory/hooks/useDepletionForecast";
import { useIngredientForecastAccuracy } from "@/features/inventory/hooks/useIngredientForecastAccuracy";
import { useMenuDemandForecast } from "@/features/inventory/hooks/useMenuDemandForecast";
import { useMenuForecastAccuracy } from "@/features/inventory/hooks/useMenuForecastAccuracy";
import { useRevenueForecastAccuracy } from "@/features/inventory/hooks/useRevenueForecastAccuracy";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";
import { cn } from "@/lib/utils";
import { formatNumber, formatWon, WEEKDAY_KO } from "@/lib/utils/format";

const FORECAST_TABS = ["revenue", "menu", "ingredient"] as const;
const HORIZON_OPTIONS = [7, 14, 30] as const;

type ForecastTab = (typeof FORECAST_TABS)[number];

export default function ForecastPage(): React.ReactElement {
  return (
    <Suspense fallback={<LoadingText />}>
      <ForecastContent />
    </Suspense>
  );
}

function ForecastContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const horizonDays = parseOption(searchParams.get("horizon"), HORIZON_OPTIONS, 7);
  const menuQuery = useMenuDemandForecast(horizonDays);
  const menuAccuracyQuery = useMenuForecastAccuracy(14);
  const revenueAccuracyQuery = useRevenueForecastAccuracy(14, activeTab === "revenue");
  const ingredientQuery = useDepletionForecast();
  const ingredientAccuracyQuery = useIngredientForecastAccuracy(14);
  const revenueDays = useMemo(
    () => buildRevenueForecastDays(menuQuery.data ?? []),
    [menuQuery.data],
  );

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="예측"
        action={
          <Link
            href={`/inventory/forecast-accuracy?tab=${activeTab}`}
            className="whitespace-nowrap rounded-2xl border border-border-strong bg-white px-4 py-3 text-body-regular font-semibold text-ink-1 shadow-soft transition hover:-translate-y-0.5 hover:border-blue/30 hover:bg-blue-soft"
          >
            정확도
          </Link>
        }
      />

      <section className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
        <p className="text-body text-ink-1">{getIntro(activeTab, horizonDays)}</p>
        <p className="mt-1 text-caption text-ink-3">
          중심값은 보정된 메뉴 예측 기준이고, 자세한 오차 검증은 정확도 화면에서 확인합니다.
        </p>
      </section>

      <ForecastTabNav activeTab={activeTab} horizonDays={horizonDays} />

      <ForecastPeriodSelector
        label="예측 기간"
        queryKey="horizon"
        selectedValue={horizonDays}
        options={HORIZON_OPTIONS}
        suffix="일"
        pathname="/inventory/forecast"
        extraParams={{ tab: activeTab }}
      />

      {activeTab === "revenue" ? (
        <ForecastSection
          title="매출 예측"
          description="메뉴별 예상 판매량과 가격으로 일별 매출을 합산합니다."
        >
          {menuQuery.isLoading && <LoadingText />}
          {menuQuery.error && <ErrorAlert message={menuQuery.error.message} />}
          {revenueAccuracyQuery.error && (
            <ErrorAlert message={revenueAccuracyQuery.error.message} />
          )}
          {menuQuery.data && (
            <RevenueForecastList
              days={revenueDays}
              meanAbsoluteWonError={revenueAccuracyQuery.data?.meanAbsoluteWonError ?? null}
            />
          )}
        </ForecastSection>
      ) : activeTab === "menu" ? (
        <ForecastSection
          title="메뉴 예측"
          description="앞으로의 메뉴별 예상 판매량과 옵션 선택률을 봅니다."
        >
          {menuQuery.isLoading && <LoadingText />}
          {menuQuery.error && <ErrorAlert message={menuQuery.error.message} />}
          {menuQuery.data && (
            <MenuDemandForecastList
              items={menuQuery.data}
              accuracyItems={menuAccuracyQuery.data ?? []}
              variant="detail"
            />
          )}
        </ForecastSection>
      ) : (
        <ForecastSection
          title="재료 예측"
          description="메뉴 수요 예측을 재료 사용량과 발주 판단으로 변환합니다."
        >
          {ingredientQuery.isLoading && <LoadingText />}
          {ingredientQuery.error && <ErrorAlert message={ingredientQuery.error.message} />}
          {ingredientQuery.data && (
            <IngredientStatusList
              items={ingredientQuery.data}
              accuracyItems={ingredientAccuracyQuery.data ?? []}
              variant="detail"
            />
          )}
        </ForecastSection>
      )}
    </section>
  );
}

function ForecastTabNav({
  activeTab,
  horizonDays,
}: {
  activeTab: ForecastTab;
  horizonDays: number;
}): React.ReactElement {
  return (
    <nav
      aria-label="예측 종류"
      className="grid grid-cols-3 gap-1 rounded-[20px] border border-border bg-card p-1.5 shadow-soft"
    >
      <ForecastTabLink
        tab="revenue"
        activeTab={activeTab}
        horizonDays={horizonDays}
        title="매출 예측"
        description="일별 예상 매출"
      />
      <ForecastTabLink
        tab="menu"
        activeTab={activeTab}
        horizonDays={horizonDays}
        title="메뉴 예측"
        description="판매량·옵션 선택률"
      />
      <ForecastTabLink
        tab="ingredient"
        activeTab={activeTab}
        horizonDays={horizonDays}
        title="재료 예측"
        description="소진·발주 판단"
      />
    </nav>
  );
}

function ForecastTabLink({
  tab,
  activeTab,
  horizonDays,
  title,
  description,
}: {
  tab: ForecastTab;
  activeTab: ForecastTab;
  horizonDays: number;
  title: string;
  description: string;
}): React.ReactElement {
  const selected = tab === activeTab;
  const params = new URLSearchParams({ tab, horizon: String(horizonDays) });

  return (
    <Link
      href={`/inventory/forecast?${params.toString()}`}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "min-w-0 rounded-2xl px-2 py-2.5 text-center transition md:px-4 md:py-3",
        selected
          ? "bg-blue text-white shadow-card"
          : "bg-white text-ink-2 shadow-soft hover:bg-blue-soft hover:text-blue-deep",
      )}
    >
      <span className="block truncate text-caption font-semibold md:text-body">{title}</span>
      <span
        className={cn(
          "mt-1 hidden text-caption md:block",
          selected ? "text-white/80" : "text-ink-3",
        )}
      >
        {description}
      </span>
    </Link>
  );
}

function ForecastSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-stack-tight">
      <h2 className="text-title-md text-ink-1">{title}</h2>
      <p className="text-caption text-ink-3">{description}</p>
      {children}
    </section>
  );
}

interface RevenueForecastDay {
  date: Date;
  predictedRevenue: number;
  predictedQuantity: number;
}

function RevenueForecastList({
  days,
  meanAbsoluteWonError,
}: {
  days: readonly RevenueForecastDay[];
  meanAbsoluteWonError: number | null;
}): React.ReactElement {
  if (days.length === 0) {
    return (
      <p className="glow-panel rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-3 shadow-soft">
        판매 이력이 있는 메뉴가 아직 없어요. 판매를 입력하면 예상 매출이 표시됩니다.
      </p>
    );
  }

  const totalRevenue = days.reduce((sum, day) => sum + day.predictedRevenue, 0);
  const totalQuantity = days.reduce((sum, day) => sum + day.predictedQuantity, 0);
  const periodMeanAbsoluteWonError =
    meanAbsoluteWonError === null ? null : meanAbsoluteWonError * Math.sqrt(days.length);

  return (
    <div className="flex flex-col gap-stack">
      <section className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
        <p className="text-caption text-ink-3">예상 매출 합계</p>
        <p className="mt-1 text-title-lg text-ink-1">
          {formatRevenueRange(totalRevenue, periodMeanAbsoluteWonError)}
        </p>
        <p className="mt-1 text-caption text-ink-3">
          예상 판매 {formatNumber(Number(totalQuantity.toFixed(1)))}개
        </p>
        {meanAbsoluteWonError !== null && (
          <p className="mt-2 text-caption text-ink-3">
            최근 14일 기준 평균 {formatWon(meanAbsoluteWonError)}원 정도 차이가 났어요.
          </p>
        )}
      </section>
      <ol className="flex flex-col gap-stack-tight">
        {days.map((day) => (
          <li
            key={day.date.toISOString()}
            className="flex items-center justify-between gap-stack rounded-[22px] border border-border bg-card px-4 py-3 shadow-soft"
          >
            <div>
              <p className="text-label text-ink-1">{formatDateLabel(day.date)}</p>
              <p className="mt-1 text-caption text-ink-3">
                예상 판매 {formatNumber(Number(day.predictedQuantity.toFixed(1)))}개
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-body font-semibold text-blue-deep">
                {formatWon(day.predictedRevenue)}원
              </p>
              {meanAbsoluteWonError !== null && (
                <p className="text-micro text-ink-3">±{formatWon(meanAbsoluteWonError)}원</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function buildRevenueForecastDays(
  menus: readonly {
    price: number;
    dailyPredictions: readonly { date: Date; predictedQuantity: number }[];
  }[],
): RevenueForecastDay[] {
  const byDate = new Map<string, RevenueForecastDay>();
  for (const menu of menus) {
    for (const day of menu.dailyPredictions) {
      const key = day.date.toISOString();
      const current = byDate.get(key) ?? {
        date: day.date,
        predictedRevenue: 0,
        predictedQuantity: 0,
      };
      current.predictedQuantity += day.predictedQuantity;
      current.predictedRevenue += day.predictedQuantity * menu.price;
      byDate.set(key, current);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function parseOption<T extends number>(raw: string | null, options: readonly T[], fallback: T): T {
  const value = Number(raw);
  return options.includes(value as T) ? (value as T) : fallback;
}

function parseTab(raw: string | null): ForecastTab {
  return FORECAST_TABS.includes(raw as ForecastTab) ? (raw as ForecastTab) : "revenue";
}

function getIntro(tab: ForecastTab, horizonDays: number): string {
  if (tab === "revenue")
    return `앞으로 ${horizonDays}일간 예상 매출과 흔들릴 수 있는 범위를 보여줍니다.`;
  if (tab === "menu")
    return `앞으로 ${horizonDays}일간 메뉴별 예상 판매량과 옵션 선택 근거를 보여줍니다.`;
  return "재료별 소진 위험, 권장 발주량, 계산 근거를 함께 보여줍니다.";
}

function formatDateLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAY_KO[date.getDay()]}`;
}

function formatRevenueRange(value: number, meanAbsoluteWonError: number | null): string {
  if (meanAbsoluteWonError === null) return `${formatWon(value)}원`;
  const low = Math.max(0, value - meanAbsoluteWonError);
  const high = value + meanAbsoluteWonError;
  return `${formatWon(low)}~${formatWon(high)}원`;
}
