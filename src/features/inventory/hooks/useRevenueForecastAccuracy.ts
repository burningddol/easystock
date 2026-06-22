"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  loadRevenueForecastAccuracyView,
  type RevenueForecastAccuracyView,
} from "@/lib/application/inventory";
import { createClient } from "@/lib/supabase/client";

export const revenueForecastAccuracyQueryKey = (backtestDays: number) =>
  ["inventory", "revenue-forecast-accuracy", backtestDays] as const;

export type { RevenueForecastAccuracyView } from "@/lib/application/inventory";

async function fetchRevenueForecastAccuracy(
  backtestDays: number,
): Promise<RevenueForecastAccuracyView> {
  const supabase = createClient();
  return loadRevenueForecastAccuracyView(supabase, backtestDays);
}

export function useRevenueForecastAccuracy(
  backtestDays: number = 14,
  enabled: boolean = true,
): UseQueryResult<RevenueForecastAccuracyView> {
  return useQuery({
    queryKey: revenueForecastAccuracyQueryKey(backtestDays),
    queryFn: () => fetchRevenueForecastAccuracy(backtestDays),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
