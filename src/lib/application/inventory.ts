import {
  forecastIngredientDemandFromMenus,
  forecastIngredient,
  forecastMenuDemand,
  type DailyConsumption,
  type DailyMenuDemand,
  type ForecastResult,
  type IngredientDemandForecast,
} from "@/lib/domain/forecast";
import {
  applyInventoryReplay as applyInventoryReplayRpc,
  getDepletionForecast,
  getMenuDemandForecast,
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
  leadTimeVendorName: string | null;
  isDefaultLeadTime: boolean;
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
    const safetyBufferDays = Number.isFinite(row.safetyBufferDays) ? row.safetyBufferDays : 1;
    const forecast = forecastIngredient({
      currentStock: row.currentStock,
      leadTimeDays: row.leadTimeDays,
      safetyBufferDays,
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
      leadTimeVendorName: row.leadTimeVendorName,
      isDefaultLeadTime: row.isDefaultLeadTime,
      safetyBufferDays,
      ...forecast,
    };
  });
}

export async function loadMenuBasedIngredientDemandForecast(
  client: RpcClient,
  horizonDays: number = 7,
): Promise<IngredientDemandForecast[]> {
  const { data, error } = await getMenuDemandForecast(client);
  if (error) throw new Error(error.message);

  const today = new Date();
  return forecastIngredientDemandFromMenus(
    (data ?? []).map((row) => {
      const demandSamples: DailyMenuDemand[] = row.demandSamples.map((sample) => ({
        date: new Date(sample.date),
        quantity: Number(sample.quantity),
      }));

      return {
        menuId: row.menuId,
        name: row.name,
        baseRecipe: row.baseRecipe,
        optionGroups: row.optionGroups,
        demandForecast: forecastMenuDemand({
          demandSamples,
          daysOff: row.regularDaysOff,
          signupDate: new Date(row.signedUpAt),
          today,
          horizonDays,
        }),
      };
    }),
  );
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
