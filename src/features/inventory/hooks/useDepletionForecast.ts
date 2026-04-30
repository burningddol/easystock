"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getDepletionForecast } from "@/lib/supabase/rpc";
import {
  forecastIngredient,
  type ForecastResult,
  type DailyConsumption,
} from "@/lib/domain/forecast";

/**
 * RPC `get_depletion_forecast`로 raw 데이터를 받아 클라이언트에서
 * `forecastIngredient`로 분류. 분류 로직 단일 출처(forecast.ts) 유지.
 */

export interface IngredientForecastView extends ForecastResult {
  ingredientId: string;
  name: string;
  unit: "g" | "ml" | "piece";
  currentStock: number;
  leadTimeDays: number;
}

export const depletionForecastQueryKey = ["inventory", "forecast"] as const;

async function fetchDepletionForecast(): Promise<IngredientForecastView[]> {
  const supabase = createClient();
  const { data, error } = await getDepletionForecast(supabase);
  if (error) throw new Error(error.message);

  const today = new Date();
  return (data ?? []).map((row) => {
    const samples: DailyConsumption[] = row.consumptionSamples.map((s) => ({
      date: new Date(s.date),
      amount: Number(s.amount),
    }));
    const forecast = forecastIngredient({
      currentStock: row.currentStock,
      leadTimeDays: row.leadTimeDays,
      consumptionSamples: samples,
      daysOff: row.regularDaysOff,
      signupDate: new Date(row.signedUpAt),
      today,
    });
    return {
      ingredientId: row.ingredientId,
      name: row.name,
      unit: row.unit,
      currentStock: row.currentStock,
      leadTimeDays: row.leadTimeDays,
      ...forecast,
    };
  });
}

export function useDepletionForecast(): UseQueryResult<IngredientForecastView[]> {
  return useQuery({
    queryKey: depletionForecastQueryKey,
    queryFn: fetchDepletionForecast,
    staleTime: 5 * 60 * 1000,
  });
}
