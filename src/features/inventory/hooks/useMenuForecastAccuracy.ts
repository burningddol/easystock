"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  loadMenuForecastAccuracyViews,
  type MenuForecastAccuracyView,
} from "@/lib/application/inventory";
import { createClient } from "@/lib/supabase/client";

export const menuForecastAccuracyQueryKey = ["inventory", "menu-forecast-accuracy"] as const;

export type { MenuForecastAccuracyView } from "@/lib/application/inventory";

async function fetchMenuForecastAccuracy(): Promise<MenuForecastAccuracyView[]> {
  const supabase = createClient();
  return loadMenuForecastAccuracyViews(supabase);
}

export function useMenuForecastAccuracy(): UseQueryResult<MenuForecastAccuracyView[]> {
  return useQuery({
    queryKey: menuForecastAccuracyQueryKey,
    queryFn: fetchMenuForecastAccuracy,
    staleTime: 5 * 60 * 1000,
  });
}
