"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  loadMenuDemandForecastViews,
  type MenuDemandForecastView,
} from "@/lib/application/inventory";
import { createClient } from "@/lib/supabase/client";

export const menuDemandForecastQueryKey = ["inventory", "menu-demand-forecast"] as const;

export type { MenuDemandForecastView } from "@/lib/application/inventory";

async function fetchMenuDemandForecast(): Promise<MenuDemandForecastView[]> {
  const supabase = createClient();
  return loadMenuDemandForecastViews(supabase);
}

export function useMenuDemandForecast(): UseQueryResult<MenuDemandForecastView[]> {
  return useQuery({
    queryKey: menuDemandForecastQueryKey,
    queryFn: fetchMenuDemandForecast,
    staleTime: 5 * 60 * 1000,
  });
}
