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

export type { IngredientForecastAccuracyView } from "@/lib/application/inventory";

async function fetchIngredientForecastAccuracy(): Promise<IngredientForecastAccuracyView[]> {
  const supabase = createClient();
  return loadIngredientForecastAccuracyViews(supabase);
}

export function useIngredientForecastAccuracy(): UseQueryResult<IngredientForecastAccuracyView[]> {
  return useQuery({
    queryKey: ingredientForecastAccuracyQueryKey,
    queryFn: fetchIngredientForecastAccuracy,
    staleTime: 5 * 60 * 1000,
  });
}
