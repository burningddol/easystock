"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { loadDepletionForecast, type IngredientForecastView } from "@/lib/application/inventory";
import type { ForecastResult } from "@/lib/domain/forecast";

/**
 * RPC `get_depletion_forecast`로 raw 데이터를 받아 클라이언트에서
 * `forecastIngredient`로 분류. 분류 로직 단일 출처(forecast.ts) 유지.
 */

export const depletionForecastQueryKey = ["inventory", "forecast"] as const;

export type { IngredientForecastView } from "@/lib/application/inventory";

async function fetchDepletionForecast(): Promise<
  Array<
    {
      ingredientId: string;
      name: string;
      unit: "g" | "ml" | "piece";
      currentStock: number;
      leadTimeDays: number;
      leadTimeVendorName: string | null;
      isDefaultLeadTime: boolean;
      safetyBufferDays: number;
    } & ForecastResult
  >
> {
  const supabase = createClient();
  return loadDepletionForecast(supabase);
}

export function useDepletionForecast(): UseQueryResult<IngredientForecastView[]> {
  return useQuery({
    queryKey: depletionForecastQueryKey,
    queryFn: fetchDepletionForecast,
    staleTime: 5 * 60 * 1000,
  });
}
