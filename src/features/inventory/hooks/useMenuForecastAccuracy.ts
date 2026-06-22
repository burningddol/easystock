"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  loadMenuForecastAccuracyViews,
  type MenuForecastAccuracyView,
} from "@/lib/application/inventory";
import { createClient } from "@/lib/supabase/client";

export const menuForecastAccuracyQueryKey = (backtestDays: number) =>
  ["inventory", "menu-forecast-accuracy", backtestDays] as const;

export type { MenuForecastAccuracyView } from "@/lib/application/inventory";

async function fetchMenuForecastAccuracy(
  backtestDays: number,
): Promise<MenuForecastAccuracyView[]> {
  const supabase = createClient();
  return loadMenuForecastAccuracyViews(supabase, backtestDays);
}

export function useMenuForecastAccuracy(
  backtestDays: number = 14,
  enabled: boolean = true,
): UseQueryResult<MenuForecastAccuracyView[]> {
  return useQuery({
    queryKey: menuForecastAccuracyQueryKey(backtestDays),
    queryFn: () => fetchMenuForecastAccuracy(backtestDays),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
