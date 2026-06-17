import {
  classifyStatus,
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

const MENU_DEMAND_DEPLETION_HORIZON_DAYS = 365;

export interface IngredientForecastView extends ForecastResult {
  ingredientId: string;
  name: string;
  unit: "g" | "ml" | "piece";
  currentStock: number;
  leadTimeDays: number;
  leadTimeVendorName: string | null;
  isDefaultLeadTime: boolean;
  safetyBufferDays: number;
  forecastSource: "menu_demand" | "consumption_history";
}

export async function loadDepletionForecast(client: RpcClient): Promise<IngredientForecastView[]> {
  const { data, error } = await getDepletionForecast(client);
  if (error) throw new Error(error.message);

  const today = new Date();
  const legacyForecasts = (data ?? []).map((row) => {
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
      forecastSource: "consumption_history" as const,
      ...forecast,
    };
  });

  const menuDemandForecasts = await loadMenuBasedIngredientDemandForecastSafely(
    client,
    MENU_DEMAND_DEPLETION_HORIZON_DAYS,
  );
  if (menuDemandForecasts.length === 0) return legacyForecasts;

  const demandByIngredient = new Map(
    menuDemandForecasts.map((forecast) => [forecast.ingredientId, forecast]),
  );

  return legacyForecasts.map((legacy) => {
    const demand = demandByIngredient.get(legacy.ingredientId);
    const depletionDate = demand
      ? predictDepletionDateFromDemand(legacy.currentStock, demand)
      : null;
    if (!depletionDate) return legacy;

    return {
      ...legacy,
      expectedDepletionDate: depletionDate,
      status: classifyStatus(depletionDate, legacy.leadTimeDays, legacy.safetyBufferDays, today),
      forecastSource: "menu_demand",
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

async function loadMenuBasedIngredientDemandForecastSafely(
  client: RpcClient,
  horizonDays: number,
): Promise<IngredientDemandForecast[]> {
  try {
    return await loadMenuBasedIngredientDemandForecast(client, horizonDays);
  } catch {
    return [];
  }
}

function predictDepletionDateFromDemand(
  currentStock: number,
  demand: IngredientDemandForecast,
): Date | null {
  let stock = currentStock;

  for (const day of demand.dailyPredictions) {
    stock -= Math.max(0, day.amount);
    if (stock <= 0) return startOfDay(day.date);
  }

  return null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
