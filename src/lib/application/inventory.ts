import {
  classifyStatus,
  computeForecastBasis,
  forecastIngredientDemandFromMenus,
  forecastIngredient,
  forecastMenuDemand,
  recommendPurchaseQuantity,
  type DailyConsumption,
  type DailyMenuDemand,
  type ForecastResult,
  type ForecastBasis,
  type IngredientDemandForecast,
  type PurchaseRecommendationResult,
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
const MENU_FORECAST_BACKTEST_DAYS = 14;

export interface IngredientForecastView extends ForecastResult {
  ingredientId: string;
  name: string;
  unit: "g" | "ml" | "piece";
  currentStock: number;
  leadTimeDays: number;
  leadTimeVendorId: string | null;
  leadTimeVendorName: string | null;
  isDefaultLeadTime: boolean;
  safetyBufferDays: number;
  purchaseCoverageDays: number;
  forecastSource: "menu_demand" | "consumption_history";
  purchaseRecommendation: PurchaseRecommendationResult | null;
}

export interface MenuDemandForecastView {
  menuId: string;
  name: string;
  price: number;
  tomorrowQuantity: number;
  sevenDayTotalQuantity: number;
  trend: "rising" | "falling" | "normal";
  isColdStart: boolean;
  basis: ForecastBasis;
  dailyPredictions: Array<{
    date: Date;
    predictedQuantity: number;
  }>;
  optionGroups: Array<{
    optionGroupId: string;
    name: string;
    selectionType: "single" | "add_on";
    values: Array<{
      optionValueId: string;
      name: string;
      selectionRate: number;
      isDefault: boolean;
    }>;
  }>;
}

export interface MenuForecastAccuracyView {
  menuId: string;
  name: string;
  averageAbsoluteError: number | null;
  meanAbsolutePercentageError: number | null;
  reliability: ForecastReliability;
  bias: "over" | "under" | "balanced" | "insufficient_data";
  evaluatedDayCount: number;
  actualTotalQuantity: number;
  predictedTotalQuantity: number;
  dailyResults: Array<{
    date: Date;
    actualQuantity: number;
    predictedQuantity: number;
    absoluteError: number;
    absolutePercentageError: number | null;
  }>;
}

export interface IngredientForecastAccuracyView {
  ingredientId: string;
  name: string;
  unit: "g" | "ml" | "piece";
  averageAbsoluteError: number | null;
  meanAbsolutePercentageError: number | null;
  reliability: ForecastReliability;
  bias: "over" | "under" | "balanced" | "insufficient_data";
  evaluatedDayCount: number;
  actualTotalAmount: number;
  predictedTotalAmount: number;
  dailyResults: Array<{
    date: Date;
    actualAmount: number;
    predictedAmount: number;
    absoluteError: number;
    absolutePercentageError: number | null;
  }>;
}

export type ForecastReliability = "good" | "watch" | "low" | "insufficient_data";

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
    const purchaseCoverageDays = Number.isFinite(row.purchaseCoverageDays)
      ? row.purchaseCoverageDays
      : 7;
    const forecast = forecastIngredient({
      currentStock: row.currentStock,
      leadTimeDays: row.leadTimeDays,
      safetyBufferDays,
      consumptionSamples: samples,
      daysOff: row.regularDaysOff,
      signupDate: new Date(row.signedUpAt),
      today,
      sensitivity: row.forecastSensitivity,
    });
    const basis =
      forecast.basis ?? computeForecastBasis(samples, row.regularDaysOff, row.forecastSensitivity);
    return {
      ingredientId: row.ingredientId,
      name: row.name,
      unit: row.unit,
      currentStock: row.currentStock,
      leadTimeDays: row.leadTimeDays,
      leadTimeVendorId: row.leadTimeVendorId,
      leadTimeVendorName: row.leadTimeVendorName,
      isDefaultLeadTime: row.isDefaultLeadTime,
      safetyBufferDays,
      purchaseCoverageDays,
      forecastSource: "consumption_history" as const,
      purchaseRecommendation: null,
      ...forecast,
      basis,
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
    if (!demand) return legacy;
    const depletionDate = predictDepletionDateFromDemand(legacy.currentStock, demand);
    if (!depletionDate) return legacy;
    const purchaseRecommendation = recommendPurchaseQuantity({
      currentStock: legacy.currentStock,
      leadTimeDays: legacy.leadTimeDays,
      safetyBufferDays: legacy.safetyBufferDays,
      dailyDemand: demand.dailyPredictions,
      today,
      coverageDays: legacy.purchaseCoverageDays,
    });

    return {
      ...legacy,
      expectedDepletionDate: depletionDate,
      status: classifyStatus(depletionDate, legacy.leadTimeDays, legacy.safetyBufferDays, today),
      forecastSource: "menu_demand",
      purchaseRecommendation,
    };
  });
}

export async function loadMenuDemandForecastViews(
  client: RpcClient,
  horizonDays: number = 7,
): Promise<MenuDemandForecastView[]> {
  const { data, error } = await getMenuDemandForecast(client);
  if (error) throw new Error(error.message);

  const today = new Date();
  return (data ?? [])
    .map((row) => {
      const demandSamples: DailyMenuDemand[] = row.demandSamples.map((sample) => ({
        date: new Date(sample.date),
        quantity: Number(sample.quantity),
      }));
      const forecast = forecastMenuDemand({
        demandSamples,
        daysOff: row.regularDaysOff,
        signupDate: new Date(row.signedUpAt),
        today,
        horizonDays,
        sensitivity: row.forecastSensitivity,
      });
      const dailyPredictions = forecast.dailyPredictions.map((day) => ({
        date: day.date,
        predictedQuantity: day.predictedQuantity,
      }));

      return {
        menuId: row.menuId,
        name: row.name,
        price: row.price,
        tomorrowQuantity: dailyPredictions[0]?.predictedQuantity ?? 0,
        sevenDayTotalQuantity: dailyPredictions.reduce(
          (sum, day) => sum + day.predictedQuantity,
          0,
        ),
        trend: forecast.trend,
        isColdStart: forecast.isColdStart,
        basis: forecast.basis,
        dailyPredictions,
        optionGroups: row.optionGroups.map((group) => ({
          optionGroupId: group.optionGroupId,
          name: group.name,
          selectionType: group.selectionType,
          values: group.values
            .map((value) => ({
              optionValueId: value.optionValueId,
              name: value.name,
              selectionRate: value.selectionRate,
              isDefault: value.isDefault,
            }))
            .sort((a, b) => b.selectionRate - a.selectionRate),
        })),
      };
    })
    .sort((a, b) => b.sevenDayTotalQuantity - a.sevenDayTotalQuantity);
}

export async function loadMenuForecastAccuracyViews(
  client: RpcClient,
  backtestDays: number = MENU_FORECAST_BACKTEST_DAYS,
): Promise<MenuForecastAccuracyView[]> {
  const { data, error } = await getMenuDemandForecast(client);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const samples = row.demandSamples
        .map((sample) => ({
          date: startOfDay(new Date(sample.date)),
          quantity: Number(sample.quantity),
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      const sampleByDate = new Map(samples.map((sample) => [dateKey(sample.date), sample]));
      const latestSampleDate = samples.at(-1)?.date ?? startOfDay(new Date());
      const targetDates = Array.from({ length: backtestDays }, (_, index) =>
        addDays(latestSampleDate, index - backtestDays + 1),
      );

      const dailyResults = targetDates.map((targetDate) => {
        const trainUntil = addDays(targetDate, -1);
        const trainingSamples: DailyMenuDemand[] = samples
          .filter((sample) => sample.date.getTime() <= trainUntil.getTime())
          .map((sample) => ({ date: sample.date, quantity: sample.quantity }));
        const forecast = forecastMenuDemand({
          demandSamples: trainingSamples,
          daysOff: row.regularDaysOff,
          signupDate: new Date(row.signedUpAt),
          today: trainUntil,
          horizonDays: 1,
          sensitivity: row.forecastSensitivity,
        });
        const actualQuantity = sampleByDate.get(dateKey(targetDate))?.quantity ?? 0;
        const predictedQuantity = forecast.dailyPredictions[0]?.predictedQuantity ?? 0;
        const absoluteError = Math.abs(predictedQuantity - actualQuantity);

        return {
          date: targetDate,
          actualQuantity,
          predictedQuantity,
          absoluteError,
          absolutePercentageError:
            actualQuantity > 0 ? absoluteError / Math.max(1, actualQuantity) : null,
        };
      });

      const evaluated = dailyResults.filter((result) => result.actualQuantity > 0);
      const actualTotalQuantity = sumBy(dailyResults, (result) => result.actualQuantity);
      const predictedTotalQuantity = sumBy(dailyResults, (result) => result.predictedQuantity);
      const averageAbsoluteError =
        evaluated.length > 0
          ? sumBy(evaluated, (result) => result.absoluteError) / evaluated.length
          : null;
      const meanAbsolutePercentageError =
        evaluated.length > 0
          ? sumBy(evaluated, (result) => result.absolutePercentageError ?? 0) / evaluated.length
          : null;

      return {
        menuId: row.menuId,
        name: row.name,
        averageAbsoluteError,
        meanAbsolutePercentageError,
        reliability: classifyForecastReliability(meanAbsolutePercentageError, evaluated.length),
        bias: classifyForecastBias(actualTotalQuantity, predictedTotalQuantity, evaluated.length),
        evaluatedDayCount: evaluated.length,
        actualTotalQuantity,
        predictedTotalQuantity,
        dailyResults,
      };
    })
    .sort((a, b) => {
      if (a.meanAbsolutePercentageError === null) return 1;
      if (b.meanAbsolutePercentageError === null) return -1;
      const aError = a.meanAbsolutePercentageError;
      const bError = b.meanAbsolutePercentageError;
      return bError - aError;
    });
}

export async function loadIngredientForecastAccuracyViews(
  client: RpcClient,
  backtestDays: number = MENU_FORECAST_BACKTEST_DAYS,
): Promise<IngredientForecastAccuracyView[]> {
  const [menuResult, ingredientResult] = await Promise.all([
    getMenuDemandForecast(client),
    getDepletionForecast(client),
  ]);
  if (menuResult.error) throw new Error(menuResult.error.message);
  if (ingredientResult.error) throw new Error(ingredientResult.error.message);

  const menus = menuResult.data ?? [];
  const ingredients = ingredientResult.data ?? [];
  const actualByIngredient = new Map(
    ingredients.map((row) => [
      row.ingredientId,
      new Map(
        row.consumptionSamples.map((sample) => [
          dateKey(startOfDay(new Date(sample.date))),
          Number(sample.amount),
        ]),
      ),
    ]),
  );
  const latestActualDate =
    ingredients
      .flatMap((row) => row.consumptionSamples.map((sample) => startOfDay(new Date(sample.date))))
      .sort((a, b) => a.getTime() - b.getTime())
      .at(-1) ?? startOfDay(new Date());
  const targetDates = Array.from({ length: backtestDays }, (_, index) =>
    addDays(latestActualDate, index - backtestDays + 1),
  );

  const predictedByIngredient = new Map<string, Map<string, number>>();
  for (const targetDate of targetDates) {
    const trainUntil = addDays(targetDate, -1);
    const predicted = forecastIngredientDemandFromMenus(
      menus.map((row) => {
        const demandSamples: DailyMenuDemand[] = row.demandSamples
          .map((sample) => ({
            date: startOfDay(new Date(sample.date)),
            quantity: Number(sample.quantity),
          }))
          .filter((sample) => sample.date.getTime() <= trainUntil.getTime());

        return {
          menuId: row.menuId,
          name: row.name,
          baseRecipe: row.baseRecipe,
          optionGroups: row.optionGroups,
          demandForecast: forecastMenuDemand({
            demandSamples,
            daysOff: row.regularDaysOff,
            signupDate: new Date(row.signedUpAt),
            today: trainUntil,
            horizonDays: 1,
            sensitivity: row.forecastSensitivity,
          }),
        };
      }),
    );

    for (const ingredient of predicted) {
      const amount = ingredient.dailyPredictions[0]?.amount ?? 0;
      const daily = predictedByIngredient.get(ingredient.ingredientId) ?? new Map<string, number>();
      daily.set(dateKey(targetDate), amount);
      predictedByIngredient.set(ingredient.ingredientId, daily);
    }
  }

  return ingredients
    .map((ingredient) => {
      const actualDaily =
        actualByIngredient.get(ingredient.ingredientId) ?? new Map<string, number>();
      const predictedDaily =
        predictedByIngredient.get(ingredient.ingredientId) ?? new Map<string, number>();
      const dailyResults = targetDates.map((date) => {
        const key = dateKey(date);
        const actualAmount = actualDaily.get(key) ?? 0;
        const predictedAmount = predictedDaily.get(key) ?? 0;
        const absoluteError = Math.abs(predictedAmount - actualAmount);
        return {
          date,
          actualAmount,
          predictedAmount,
          absoluteError,
          absolutePercentageError:
            actualAmount > 0 ? absoluteError / Math.max(1, actualAmount) : null,
        };
      });
      const evaluated = dailyResults.filter((result) => result.actualAmount > 0);
      const actualTotalAmount = sumBy(dailyResults, (result) => result.actualAmount);
      const predictedTotalAmount = sumBy(dailyResults, (result) => result.predictedAmount);
      const averageAbsoluteError =
        evaluated.length > 0
          ? sumBy(evaluated, (result) => result.absoluteError) / evaluated.length
          : null;
      const meanAbsolutePercentageError =
        evaluated.length > 0
          ? sumBy(evaluated, (result) => result.absolutePercentageError ?? 0) / evaluated.length
          : null;

      return {
        ingredientId: ingredient.ingredientId,
        name: ingredient.name,
        unit: ingredient.unit,
        averageAbsoluteError,
        meanAbsolutePercentageError,
        reliability: classifyForecastReliability(meanAbsolutePercentageError, evaluated.length),
        bias: classifyForecastBias(actualTotalAmount, predictedTotalAmount, evaluated.length),
        evaluatedDayCount: evaluated.length,
        actualTotalAmount,
        predictedTotalAmount,
        dailyResults,
      };
    })
    .sort((a, b) => {
      if (a.meanAbsolutePercentageError === null) return 1;
      if (b.meanAbsolutePercentageError === null) return -1;
      return b.meanAbsolutePercentageError - a.meanAbsolutePercentageError;
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
          sensitivity: row.forecastSensitivity,
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

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function sumBy<T>(items: readonly T[], selector: (item: T) => number): number {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

function classifyForecastBias(
  actualTotalQuantity: number,
  predictedTotalQuantity: number,
  evaluatedDayCount: number,
): MenuForecastAccuracyView["bias"] {
  if (evaluatedDayCount === 0 || actualTotalQuantity === 0) return "insufficient_data";

  const ratio = predictedTotalQuantity / actualTotalQuantity;
  if (ratio >= 1.15) return "over";
  if (ratio <= 0.85) return "under";
  return "balanced";
}

function classifyForecastReliability(
  meanAbsolutePercentageError: number | null,
  evaluatedDayCount: number,
): ForecastReliability {
  if (evaluatedDayCount < 3 || meanAbsolutePercentageError === null) return "insufficient_data";
  if (meanAbsolutePercentageError >= 0.8) return "low";
  if (meanAbsolutePercentageError >= 0.35) return "watch";
  return "good";
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
