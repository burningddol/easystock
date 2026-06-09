"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { loadCalendarMonth, type CalendarMonthView } from "@/lib/application/calendar";

export const calendarQueryKey = ["calendar"] as const;

export function calendarMonthQueryKey(
  year: number,
  month: number,
): readonly ["calendar", "month", number, number] {
  return ["calendar", "month", year, month] as const;
}

async function fetchCalendarMonth(year: number, month: number): Promise<CalendarMonthView> {
  const supabase = createClient();
  return loadCalendarMonth(supabase, year, month);
}

export function useCalendarMonth(
  year: number | null,
  month: number | null,
): UseQueryResult<CalendarMonthView> {
  return useQuery({
    queryKey: calendarMonthQueryKey(year ?? 0, month ?? 0),
    queryFn: () => {
      // queryKey가 enabled 가드 통과 후에만 실행되므로 정상 경로에서 null 도달 불가.
      // 단, queryFn 시그니처가 동기 narrow를 못 보므로 명시 throw로 type-narrow.
      if (year === null || month === null) throw new Error("disabled");
      return fetchCalendarMonth(year, month);
    },
    staleTime: 5 * 60 * 1000,
    enabled: year !== null && month !== null,
  });
}
