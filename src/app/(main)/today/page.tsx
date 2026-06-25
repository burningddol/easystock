"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { useTodayDashboard } from "@/features/dashboard/hooks/useTodayDashboard";
import { useDepletionForecast } from "@/features/inventory/hooks/useDepletionForecast";
import { YesterdayKpiCard } from "@/features/dashboard/components/YesterdayKpiCard";
import { AlertsCard } from "@/features/dashboard/components/AlertsCard";
import { MarginTop3Card } from "@/features/dashboard/components/MarginTop3Card";
import { MissingSaleBadge } from "@/features/dashboard/components/MissingSaleBadge";
import { trackEvent } from "@/lib/analytics/ga4";
import { formatNumber, formatTodayKo } from "@/lib/utils/format";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import type { IngredientForecastView } from "@/lib/application/inventory";

/**
 * 홈 (오늘) 대시보드 — patterns.md "홈" 위계 순서대로 렌더.
 * 1) 헤더 + 어제 판매 미입력 배지 (FR-091)
 * 2) 어제 KPI Hero
 * 3) 오늘 할 일 알림 (발주/만료/입력)
 * 4) 이번 주 메뉴 마진 TOP 3 + 마진 하락 메뉴
 * 5) 빠른 입력 (매입 / 판매)
 *
 * 발주 알림은 useDepletionForecast로 별도 호출 (useTodayDashboard와 병렬).
 */
export default function TodayPage(): React.ReactElement {
  const dashboard = useTodayDashboard();
  const forecast = useDepletionForecast();
  // SSR 렌더 시점과 클라이언트 hydrate 시점이 자정을 넘기면 날짜 라벨이 어긋나 hydration
  // mismatch를 일으킨다. 클라이언트 마운트 후 effect로 채움.
  const [todayLabel, setTodayLabel] = useState<string>("");

  useEffect(() => {
    setTodayLabel(formatTodayKo());
  }, []);

  useEffect(() => {
    if (dashboard.data) {
      trackEvent("dashboard_viewed", {
        has_yesterday_sale: !dashboard.data.missingYesterdaySale,
        top3_count: dashboard.data.top3Menus.length,
      });
    }
  }, [dashboard.data]);

  if (dashboard.isLoading) {
    return <p className="text-body-regular text-ink-3">불러오는 중…</p>;
  }
  if (dashboard.error || !dashboard.data) {
    return (
      <p className="text-body-regular text-red-deep">
        데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
      </p>
    );
  }

  const { data } = dashboard;
  const orderItems = (forecast.data ?? []).filter(
    (item) => item.purchaseRecommendation?.isOrderRecommended,
  );

  return (
    <section className="flex flex-col gap-section pb-12">
      <header className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
        <div className="flex items-start justify-between gap-stack">
          <div className="min-w-0 flex-1">
            <p className="text-micro uppercase tracking-[0.14em] text-blue-deep">Today</p>
            <h1 className="mt-1 break-words text-title-lg text-ink-1">{data.storeName}</h1>
            <p className="text-caption text-ink-3">{todayLabel}</p>
            {data.missingYesterdaySale && (
              <div className="mt-3">
                <MissingSaleBadge yesterdaySoldAt={data.yesterday.soldAt} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-stack-tight">
            <Link
              href="/settings"
              aria-label="가게 설정"
              title="가게 설정"
              className={`${SECONDARY_BUTTON_CLASSES} flex h-11 w-11 items-center justify-center px-0`}
            >
              <Settings size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mt-stack flex flex-col gap-4 rounded-2xl border border-blue/10 bg-blue-soft px-stack py-stack shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-caption text-blue-deep">예측 대시보드</p>
            <p className="mt-1 text-body text-ink-1">
              매출, 메뉴 수요, 재료 소진 예측과 정확도를 확인하세요.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <Link
              href="/inventory/forecast?tab=revenue"
              className="inline-flex w-fit items-center rounded-full bg-white px-4 py-2.5 text-caption font-semibold text-blue-deep shadow-soft transition hover:-translate-y-0.5 hover:bg-blue-soft"
            >
              예측 보기
            </Link>
            <Link
              href="/inventory/forecast-accuracy?tab=revenue"
              className="inline-flex w-fit items-center rounded-full border border-blue/15 bg-white/70 px-4 py-2.5 text-caption font-semibold text-ink-2 shadow-soft transition hover:-translate-y-0.5 hover:bg-white"
            >
              예측 정확도
            </Link>
          </div>
        </div>
      </header>

      <AlertsCard
        depletionItems={forecast.data ?? []}
        expiryAlerts={data.expiryAlerts}
        missingYesterdaySale={data.missingYesterdaySale}
        yesterdaySoldAt={data.yesterday.soldAt}
      />

      <nav className="grid grid-cols-2 gap-stack">
        <QuickAction href="/sale" label="판매 입력" tone="primary" />
        <QuickAction href="/purchase" label="매입 등록" tone="secondary" />
      </nav>

      <YesterdayKpiCard yesterday={data.yesterday} weeklyChart={data.weeklyChart} />

      <OrderSummaryCard items={orderItems} isLoading={forecast.isLoading} />

      <MarginTop3Card top3={data.top3Menus} lowMargin={data.lowMarginMenu} />
    </section>
  );
}

function OrderSummaryCard({
  items,
  isLoading,
}: {
  items: readonly IngredientForecastView[];
  isLoading: boolean;
}): React.ReactElement {
  const urgentCount = items.filter((item) => item.status === "critical").length;
  const coverageDays = items[0]?.purchaseRecommendation?.targetCoverageDays ?? 7;
  const topItems = items.slice(0, 3);

  return (
    <section className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-micro uppercase tracking-[0.14em] text-blue-deep">Order</p>
          <h2 className="mt-1 text-title-md text-ink-1">
            {isLoading
              ? "발주 추천 확인 중"
              : items.length > 0
                ? `오늘 주문할 재료 ${items.length}개`
                : "오늘 바로 주문할 재료 없음"}
          </h2>
          <p className="mt-1 text-caption text-ink-3">
            리드타임 + 안전여유 + {coverageDays}일 운영분 기준으로 계산합니다.
          </p>
        </div>
        <Link
          href="/inventory/orders"
          className="halo-cta self-start rounded-2xl bg-brand-primary px-4 py-3 text-label font-semibold text-white shadow-card transition hover:-translate-y-0.5 sm:self-auto"
        >
          발주 추천 보기
        </Link>
      </div>

      {items.length > 0 && (
        <div className="mt-stack flex flex-col gap-2">
          {urgentCount > 0 && (
            <p className="rounded-2xl bg-red-soft px-3 py-2 text-caption text-red-deep">
              긴급 발주 {urgentCount}개가 있습니다.
            </p>
          )}
          <ul className="flex flex-wrap gap-2">
            {topItems.map((item) => (
              <li
                key={item.ingredientId}
                className="rounded-full bg-blue-soft px-3 py-1.5 text-caption text-blue-deep"
              >
                {item.name}{" "}
                {formatNumber(
                  Math.ceil(item.purchaseRecommendation?.recommendedOrderQuantity ?? 0),
                )}
                {item.unit}
              </li>
            ))}
            {items.length > topItems.length && (
              <li className="rounded-full bg-bg px-3 py-1.5 text-caption text-ink-3">
                +{items.length - topItems.length}개
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

interface QuickActionProps {
  href: string;
  label: string;
  tone: "primary" | "secondary";
}

function QuickAction({ href, label, tone }: QuickActionProps): React.ReactElement {
  return (
    <Link
      href={href}
      className={
        tone === "primary"
          ? "flex items-center justify-center rounded-2xl bg-blue py-3.5 text-body font-semibold text-white shadow-soft transition hover:bg-blue-deep"
          : "flex items-center justify-center rounded-2xl border border-border-strong bg-white py-3.5 text-body font-medium text-ink-1 shadow-soft transition hover:border-blue/30 hover:bg-blue-soft"
      }
    >
      {label}
    </Link>
  );
}
