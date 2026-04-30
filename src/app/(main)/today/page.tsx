"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTodayDashboard } from "@/features/dashboard/hooks/useTodayDashboard";
import { useDepletionForecast } from "@/features/inventory/hooks/useDepletionForecast";
import { YesterdayKpiCard } from "@/features/dashboard/components/YesterdayKpiCard";
import { AlertsCard } from "@/features/dashboard/components/AlertsCard";
import { MarginTop3Card } from "@/features/dashboard/components/MarginTop3Card";
import { MissingSaleBadge } from "@/features/dashboard/components/MissingSaleBadge";
import { trackEvent } from "@/lib/analytics/ga4";
import { formatTodayKo } from "@/lib/utils/format";

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

  return (
    <section className="flex flex-col gap-section">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-title-lg text-ink-1">{data.storeName}</h1>
          <p className="text-caption text-ink-3">{todayLabel}</p>
        </div>
        {data.missingYesterdaySale && <MissingSaleBadge yesterdaySoldAt={data.yesterday.soldAt} />}
      </header>

      <YesterdayKpiCard yesterday={data.yesterday} weeklyChart={data.weeklyChart} />

      <AlertsCard
        depletionItems={forecast.data ?? []}
        expiryAlerts={data.expiryAlerts}
        missingYesterdaySale={data.missingYesterdaySale}
        yesterdaySoldAt={data.yesterday.soldAt}
      />

      <MarginTop3Card top3={data.top3Menus} lowMargin={data.lowMarginMenu} />

      <nav className="grid grid-cols-2 gap-stack">
        <QuickAction href="/purchase" label="매입 등록" />
        <QuickAction href="/sale" label="판매 입력" />
      </nav>
    </section>
  );
}

interface QuickActionProps {
  href: string;
  label: string;
}

function QuickAction({ href, label }: QuickActionProps): React.ReactElement {
  return (
    <Link
      href={href}
      className="flex items-center justify-center rounded-xl border border-border bg-card py-3 text-body text-ink-1"
    >
      {label}
    </Link>
  );
}
