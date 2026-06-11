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
import { formatTodayKo } from "@/lib/utils/format";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";

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

        <div className="mt-stack rounded-2xl border border-blue/10 bg-blue-soft px-stack py-stack shadow-soft">
          <p className="text-caption text-blue-deep">오늘 우선순위</p>
          <p className="mt-1 text-body text-ink-1">
            {data.missingYesterdaySale
              ? "어제 판매 입력을 먼저 끝내고, 발주가 필요한 재료를 확인하세요."
              : "오늘 필요한 발주와 마진 변화를 먼저 확인하세요."}
          </p>
        </div>
      </header>

      <YesterdayKpiCard yesterday={data.yesterday} weeklyChart={data.weeklyChart} />

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

      <MarginTop3Card top3={data.top3Menus} lowMargin={data.lowMarginMenu} />
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
