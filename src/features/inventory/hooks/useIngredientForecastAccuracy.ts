"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  loadIngredientForecastAccuracyViews,
  type IngredientForecastAccuracyView,
} from "@/lib/application/inventory";
import { createClient } from "@/lib/supabase/client";

export const ingredientForecastAccuracyQueryKey = [
  "inventory",
  "ingredient-forecast-accuracy",
] as const;

export const ingredientForecastAccuracyQueryKeyWithPeriod = (backtestDays: number) =>
  [...ingredientForecastAccuracyQueryKey, backtestDays] as const;

export type { IngredientForecastAccuracyView } from "@/lib/application/inventory";

async function fetchIngredientForecastAccuracy(
  backtestDays: number,
): Promise<IngredientForecastAccuracyView[]> {
  const supabase = createClient();
  return loadIngredientForecastAccuracyViews(supabase, backtestDays);
}

export function useIngredientForecastAccuracy(
  backtestDays: number = 14,
  enabled: boolean = true,
): UseQueryResult<IngredientForecastAccuracyView[]> {
  return useQuery({
    queryKey: ingredientForecastAccuracyQueryKeyWithPeriod(backtestDays),
    queryFn: () => fetchIngredientForecastAccuracy(backtestDays),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
