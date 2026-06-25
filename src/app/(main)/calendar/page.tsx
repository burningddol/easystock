"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCalendarMonth } from "@/features/calendar/hooks/useCalendarMonth";
import { useMenuDemandForecast } from "@/features/inventory/hooks/useMenuDemandForecast";
import { useRevenueForecastAccuracy } from "@/features/inventory/hooks/useRevenueForecastAccuracy";
import { getRevenueMeanSignedWonError } from "@/features/inventory/lib/revenue-forecast-adjustment";
import { MonthHeader } from "@/features/calendar/components/MonthHeader";
import { MonthCumulativeCard } from "@/features/calendar/components/MonthCumulativeCard";
import { CalendarGrid } from "@/features/calendar/components/CalendarGrid";
import { CalendarLegend } from "@/features/calendar/components/CalendarLegend";
import { buildCalendarMenuForecastByDate } from "@/features/calendar/lib/menu-forecast-calendar";
import { CALENDAR_SHORT_FORECAST_DAYS } from "@/features/calendar/lib/forecast-window";
import { trackEvent } from "@/lib/analytics/ga4";
import { localIsoDate } from "@/lib/utils/format";
import { useTodayIso } from "@/lib/utils/use-today-iso";
import type { EnrichedCalendarCell } from "@/features/calendar/lib/consecutive-missing";

/**
 * 월간 캘린더 페이지 — patterns.md "캘린더" 위계대로 렌더.
 * 1) 헤더 (월 네비)
 * 2) 월 누적 KPI
 * 3) 7×6 그리드 + 범례
 * 4) 날짜 클릭 시 상세 페이지 진입
 *
 * 셀 클릭 → /calendar/[date] 이동 + 누락일이면 calendar_missing_day_clicked GA4 발화 (T165, D7 funnel 핵심).
 * 페이지 mount → calendar_viewed GA4 발화 (T164).
 */
export default function CalendarPage(): React.ReactElement {
  const router = useRouter();
  const todayIso = useTodayIso();
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);

  // 초기 mount 시 클라이언트 시각으로 현재 연/월 세팅 (SSR/CSR drift 차단)
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }, []);

  const query = useCalendarMonth(year, month);
  const menuForecastQuery = useMenuDemandForecast(CALENDAR_SHORT_FORECAST_DAYS);
  const revenueAccuracyQuery = useRevenueForecastAccuracy(30);
  const menuForecastByDate = useMemo(
    () => buildCalendarMenuForecastByDate(menuForecastQuery.data ?? []),
    [menuForecastQuery.data],
  );
  const revenueErrorByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        absoluteWonError: number;
        signedWonError: number;
        weightedAbsolutePercentageError: number | null;
      }
    >();
    for (const day of revenueAccuracyQuery.data?.dailyResults ?? []) {
      map.set(localIsoDate(day.date), {
        absoluteWonError: day.absoluteWonError,
        signedWonError: day.signedWonError,
        weightedAbsolutePercentageError: day.weightedAbsolutePercentageError,
      });
    }
    return map;
  }, [revenueAccuracyQuery.data]);

  // primitive deps로 month 변경 + operating_days 변경에만 발화. 동일 데이터 refetch엔 skip.
  const operatingDays = query.data?.cumulative.operatingDays ?? null;
  useEffect(() => {
    if (year === null || month === null || operatingDays === null) return;
    trackEvent("calendar_viewed", { year, month, operating_days: operatingDays });
  }, [year, month, operatingDays]);

  function handleSelect(cell: EnrichedCalendarCell): void {
    if (cell.isMissing) {
      trackEvent("calendar_missing_day_clicked", {
        date: cell.date,
        consecutive_missing_days: cell.consecutiveMissingDays,
      });
    }
    router.push(`/calendar/${cell.date}`);
  }

  function navigate(delta: number): void {
    if (year === null || month === null) return;
    const nextRaw = month + delta;
    if (nextRaw < 1) {
      setYear(year - 1);
      setMonth(12);
    } else if (nextRaw > 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(nextRaw);
    }
  }

  if (year === null || month === null || query.isLoading) {
    return (
      <p className="glow-panel rounded-[28px] border border-white/70 bg-white/92 px-5 py-4 text-body-regular text-ink-3 shadow-soft">
        불러오는 중…
      </p>
    );
  }
  if (query.error || !query.data) {
    return (
      <p className="rounded-[28px] bg-rose-50 px-5 py-4 text-body-regular text-rose-700 shadow-soft">
        데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-section">
      <MonthHeader
        year={year}
        month={month}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
      />
      <MonthCumulativeCard
        cumulative={query.data.cumulative}
        marginLabel={query.data.marginLabel}
      />
      <CalendarGrid
        year={year}
        month={month}
        cells={query.data.cells}
        menuForecastByDate={menuForecastByDate}
        revenueErrorByDate={revenueErrorByDate}
        revenueMeanAbsoluteWonError={revenueAccuracyQuery.data?.meanAbsoluteWonError ?? null}
        revenueMeanSignedWonError={getRevenueMeanSignedWonError(revenueAccuracyQuery.data)}
        selectedDate={null}
        todayIso={todayIso}
        onSelect={handleSelect}
      />
      <CalendarLegend />
    </section>
  );
}
