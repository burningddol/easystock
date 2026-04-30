"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCalendarMonth, type CalendarMonthData } from "@/lib/supabase/rpc";
import { withConsecutiveMissingDays, type EnrichedCalendarCell } from "../lib/consecutive-missing";

export interface CalendarMonthView extends Omit<CalendarMonthData, "cells"> {
  cells: EnrichedCalendarCell[];
}

export const calendarMonthQueryKey = (year: number, month: number) =>
  ["calendar", "month", year, month] as const;

async function fetchCalendarMonth(year: number, month: number): Promise<CalendarMonthView> {
  const supabase = createClient();
  const { data, error } = await getCalendarMonth(supabase, { year, month });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("calendar data missing");
  return { ...data, cells: withConsecutiveMissingDays(data.cells) };
}

export function useCalendarMonth(
  year: number | null,
  month: number | null,
): UseQueryResult<CalendarMonthView> {
  return useQuery({
    queryKey: calendarMonthQueryKey(year ?? 0, month ?? 0),
    queryFn: () => fetchCalendarMonth(year as number, month as number),
    // 월간 데이터는 변동이 적고 sale/purchase 변경 시 명시적 invalidate가 더 정확.
    staleTime: 5 * 60 * 1000,
    // year/month가 mount 전에는 null이라 placeholder 쿼리(0,0)가 발사되지 않도록 차단.
    enabled: year !== null && month !== null,
  });
}
