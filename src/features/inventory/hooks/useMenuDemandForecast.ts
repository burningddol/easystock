"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  loadMenuDemandForecastViews,
  type MenuDemandForecastView,
} from "@/lib/application/inventory";
import { createClient } from "@/lib/supabase/client";

export const menuDemandForecastQueryKey = (horizonDays: number) =>
  ["inventory", "menu-demand-forecast", horizonDays] as const;

export type { MenuDemandForecastView } from "@/lib/application/inventory";

async function fetchMenuDemandForecast(horizonDays: number): Promise<MenuDemandForecastView[]> {
  const supabase = createClient();
  return loadMenuDemandForecastViews(supabase, horizonDays);
}

export function useMenuDemandForecast(
  horizonDays: number = 7,
): UseQueryResult<MenuDemandForecastView[]> {
  return useQuery({
    queryKey: menuDemandForecastQueryKey(horizonDays),
    queryFn: () => fetchMenuDemandForecast(horizonDays),
    staleTime: 5 * 60 * 1000,
  });
}
