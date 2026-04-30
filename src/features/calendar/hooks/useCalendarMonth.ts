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

export function useCalendarMonth(year: number, month: number): UseQueryResult<CalendarMonthView> {
  return useQuery({
    queryKey: calendarMonthQueryKey(year, month),
    queryFn: () => fetchCalendarMonth(year, month),
    // 월간 데이터는 변동이 적고 sale/purchase 변경 시 명시적 invalidate가 더 정확.
    staleTime: 5 * 60 * 1000,
  });
}
