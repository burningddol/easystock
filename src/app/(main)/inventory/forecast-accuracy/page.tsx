"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ForecastPeriodSelector } from "@/features/inventory/components/ForecastPeriodSelector";
import { IngredientForecastAccuracyList } from "@/features/inventory/components/IngredientForecastAccuracyList";
import { MenuForecastAccuracyList } from "@/features/inventory/components/MenuForecastAccuracyList";
import { RevenueForecastAccuracyCard } from "@/features/inventory/components/RevenueForecastAccuracyCard";
import { useIngredientForecastAccuracy } from "@/features/inventory/hooks/useIngredientForecastAccuracy";
import { useMenuForecastAccuracy } from "@/features/inventory/hooks/useMenuForecastAccuracy";
import { useRevenueForecastAccuracy } from "@/features/inventory/hooks/useRevenueForecastAccuracy";
import { PageHeader } from "@/components/ui/page-header";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";
import { cn } from "@/lib/utils";

const BACKTEST_OPTIONS = [14, 30, 60] as const;
const ACCURACY_TABS = ["revenue", "menu", "ingredient"] as const;

type AccuracyTab = (typeof ACCURACY_TABS)[number];

export default function ForecastAccuracyPage(): React.ReactElement {
  return (
    <Suspense fallback={<LoadingText />}>
      <ForecastAccuracyContent />
    </Suspense>
  );
}

function ForecastAccuracyContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const backtestDays = parseOption(searchParams.get("days"), BACKTEST_OPTIONS, 14);
  const activeTab = parseTab(searchParams.get("tab"));
  const revenueQuery = useRevenueForecastAccuracy(backtestDays, activeTab === "revenue");
  const menuQuery = useMenuForecastAccuracy(backtestDays, activeTab === "menu");
  const ingredientQuery = useIngredientForecastAccuracy(backtestDays, activeTab === "ingredient");

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="예측 정확도"
        action={
          <Link href={`/inventory/forecast?tab=${activeTab}`} className={SECONDARY_BUTTON_CLASSES}>
            예측 보기
          </Link>
        }
      />

      <section className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
        <p className="text-body text-ink-1">
          최근 {backtestDays}일 기준으로 {getTabNoun(activeTab)} 예측과 실제값을 비교합니다.
        </p>
        <p className="mt-1 text-caption text-ink-3">
          각 날짜의 예측은 그 전날까지의 판매 이력만 사용해 다시 계산합니다.
        </p>
      </section>

      <AccuracyTabNav activeTab={activeTab} backtestDays={backtestDays} />

      <ForecastPeriodSelector
        label="백테스트 기간"
        queryKey="days"
        selectedValue={backtestDays}
        options={BACKTEST_OPTIONS}
        suffix="일"
        pathname="/inventory/forecast-accuracy"
        extraParams={{ tab: activeTab }}
      />

      {activeTab === "revenue" ? (
        <AccuracySection
          title="매출 예측 정확도"
          description="메뉴 수요 예측으로 환산한 예상 매출과 실제 매출을 비교합니다."
        >
          {revenueQuery.isLoading && <LoadingText />}
          {revenueQuery.error && <ErrorAlert message={revenueQuery.error.message} />}
          {revenueQuery.data && <RevenueForecastAccuracyCard data={revenueQuery.data} />}
        </AccuracySection>
      ) : activeTab === "menu" ? (
        <AccuracySection
          title="메뉴 예측 정확도"
          description="메뉴별 예상 판매량과 실제 판매량을 비교합니다."
        >
          {menuQuery.isLoading && <LoadingText />}
          {menuQuery.error && <ErrorAlert message={menuQuery.error.message} />}
          {menuQuery.data && <MenuForecastAccuracyList items={menuQuery.data} />}
        </AccuracySection>
      ) : (
        <AccuracySection
          title="재료 예측 정확도"
          description="메뉴 수요 예측에서 환산한 재료 소비량과 실제 소비량을 비교합니다."
        >
          {ingredientQuery.isLoading && <LoadingText />}
          {ingredientQuery.error && <ErrorAlert message={ingredientQuery.error.message} />}
          {ingredientQuery.data && <IngredientForecastAccuracyList items={ingredientQuery.data} />}
        </AccuracySection>
      )}
    </section>
  );
}

function parseOption<T extends number>(raw: string | null, options: readonly T[], fallback: T): T {
  const value = Number(raw);
  return options.includes(value as T) ? (value as T) : fallback;
}

function parseTab(raw: string | null): AccuracyTab {
  return ACCURACY_TABS.includes(raw as AccuracyTab) ? (raw as AccuracyTab) : "revenue";
}

function getTabNoun(tab: AccuracyTab): string {
  if (tab === "revenue") return "매출";
  if (tab === "menu") return "메뉴 판매";
  return "재료 소비";
}

function AccuracyTabNav({
  activeTab,
  backtestDays,
}: {
  activeTab: AccuracyTab;
  backtestDays: number;
}): React.ReactElement {
  return (
    <nav
      aria-label="예측 정확도 종류"
      className="grid grid-cols-3 gap-1 rounded-[20px] border border-border bg-card p-1.5 shadow-soft"
    >
      <AccuracyTabLink
        tab="revenue"
        activeTab={activeTab}
        backtestDays={backtestDays}
        title="매출 예측"
        description="운영 판단 기준"
      />
      <AccuracyTabLink
        tab="menu"
        activeTab={activeTab}
        backtestDays={backtestDays}
        title="메뉴 예측"
        description="판매량·예상 매출 기준"
      />
      <AccuracyTabLink
        tab="ingredient"
        activeTab={activeTab}
        backtestDays={backtestDays}
        title="재료 예측"
        description="소비량·발주 판단 기준"
      />
    </nav>
  );
}

function AccuracyTabLink({
  tab,
  activeTab,
  backtestDays,
  title,
  description,
}: {
  tab: AccuracyTab;
  activeTab: AccuracyTab;
  backtestDays: number;
  title: string;
  description: string;
}): React.ReactElement {
  const selected = tab === activeTab;
  const params = new URLSearchParams({ tab, days: String(backtestDays) });

  return (
    <Link
      href={`/inventory/forecast-accuracy?${params.toString()}`}
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

function AccuracySection({
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
