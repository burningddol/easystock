import {
  forecastIngredient,
  type DailyConsumption,
  type ForecastResult,
} from "@/lib/domain/forecast";
import {
  applyInventoryReplay as applyInventoryReplayRpc,
  getDepletionForecast,
  type ApplyInventoryReplayResult,
} from "@/lib/supabase/rpc";

interface RpcClient {
  rpc: unknown;
}

export interface IngredientForecastView extends ForecastResult {
  ingredientId: string;
  name: string;
  unit: "g" | "ml" | "piece";
  currentStock: number;
  leadTimeDays: number;
  safetyBufferDays: number;
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
      safetyBufferDays: row.safetyBufferDays,
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
      safetyBufferDays: row.safetyBufferDays,
      ...forecast,
    };
  });
}

export interface ApplyInventoryReplayInput {
  fromDate: string;
  note?: string;
}

export async function applyInventoryReplay(
  client: RpcClient,
  input: ApplyInventoryReplayInput,
): Promise<ApplyInventoryReplayResult> {
  const { data, error } = await applyInventoryReplayRpc(client, input);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("apply_inventory_replay: no row returned");
  return data;
}
