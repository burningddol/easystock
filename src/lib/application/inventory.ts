import {
  forecastIngredient,
  type DailyConsumption,
  type ForecastResult,
} from "@/lib/domain/forecast";
import { getDepletionForecast } from "@/lib/supabase/rpc";

interface RpcClient {
  rpc: unknown;
}

export interface IngredientForecastView extends ForecastResult {
  ingredientId: string;
  name: string;
  unit: "g" | "ml" | "piece";
  currentStock: number;
  leadTimeDays: number;
}

export async function loadDepletionForecast(client: RpcClient): Promise<IngredientForecastView[]> {
  const { data, error } = await getDepletionForecast(client);
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
