"use client";

import { useEffect, useState } from "react";
import { useCalendarMonth } from "@/features/calendar/hooks/useCalendarMonth";
import { MonthHeader } from "@/features/calendar/components/MonthHeader";
import { MonthCumulativeCard } from "@/features/calendar/components/MonthCumulativeCard";
import { CalendarGrid } from "@/features/calendar/components/CalendarGrid";
import { CellDetailPanel } from "@/features/calendar/components/CellDetailPanel";
import { CalendarLegend } from "@/features/calendar/components/CalendarLegend";
import { trackEvent } from "@/lib/analytics/ga4";
import { useTodayIso } from "@/lib/utils/use-today-iso";
import type { EnrichedCalendarCell } from "@/features/calendar/lib/consecutive-missing";

/**
 * 월간 캘린더 페이지 — patterns.md "캘린더" 위계대로 렌더.
 * 1) 헤더 (월 네비)
 * 2) 월 누적 KPI
 * 3) 7×6 그리드 + 범례
 * 4) 선택일 상세 (선택 시)
 *
 * 셀 클릭 → 선택 셀 갱신 + 누락일이면 calendar_missing_day_clicked GA4 발화 (T165, D7 funnel 핵심).
 * 페이지 mount → calendar_viewed GA4 발화 (T164).
 */
export default function CalendarPage(): React.ReactElement {
  const todayIso = useTodayIso();
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 초기 mount 시 클라이언트 시각으로 현재 연/월 세팅 (SSR/CSR drift 차단)
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }, []);

  const query = useCalendarMonth(year, month);

  // monthKey + operating_days만 dep으로 두면 같은 월의 refetch (참조만 다른 동일 데이터)에는
  // 중복 발화하지 않음. 값이 실제로 변하는 경우에만 트래킹.
  const monthKey = year !== null && month !== null ? `${year}-${month}` : null;
  const operatingDays = query.data?.cumulative.operatingDays ?? null;
  useEffect(() => {
    if (operatingDays === null || !monthKey) return;
    const [y, m] = monthKey.split("-").map(Number);
    trackEvent("calendar_viewed", {
      year: y as number,
      month: m as number,
      operating_days: operatingDays,
    });
  }, [monthKey, operatingDays]);

  function handleSelect(cell: EnrichedCalendarCell): void {
    setSelectedDate(cell.date);
    if (cell.isMissing) {
      trackEvent("calendar_missing_day_clicked", {
        date: cell.date,
        consecutive_missing_days: cell.consecutiveMissingDays,
      });
    }
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
    setSelectedDate(null);
  }

  function jumpToday(): void {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDate(null);
  }

  if (year === null || month === null || query.isLoading) {
    return <p className="text-body-regular text-ink-3">불러오는 중…</p>;
  }
  if (query.error || !query.data) {
    return (
      <p className="text-body-regular text-red-deep">
        데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
      </p>
    );
  }

  const selectedCell =
    selectedDate !== null ? (query.data.cells.find((c) => c.date === selectedDate) ?? null) : null;

  return (
    <section className="flex flex-col gap-section">
      <MonthHeader
        year={year}
        month={month}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={jumpToday}
      />
      <MonthCumulativeCard
        cumulative={query.data.cumulative}
        marginLabel={query.data.marginLabel}
      />
      <CalendarGrid
        year={year}
        month={month}
        cells={query.data.cells}
        selectedDate={selectedDate}
        todayIso={todayIso}
        onSelect={handleSelect}
      />
      <CalendarLegend />
      {/* todayIso는 mount 후 채워짐 — null이면 CellDetailPanel의 daysFromToday 계산이
          1970 fallback에 의존하게 되므로 명시적으로 null guard. */}
      {selectedCell && todayIso && <CellDetailPanel cell={selectedCell} todayIso={todayIso} />}
    </section>
  );
}
