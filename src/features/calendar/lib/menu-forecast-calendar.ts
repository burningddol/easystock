import { localIsoDate } from "@/lib/utils/format";
import type { MenuDemandForecastView } from "@/features/inventory/hooks/useMenuDemandForecast";

export interface CalendarMenuForecastItem {
  menuId: string;
  name: string;
  price: number;
  predictedQuantity: number;
  predictedRevenue: number;
  confidenceLevel: MenuDemandForecastView["basis"]["confidenceLevel"];
  usableSampleCount: number;
  weekdayConfidence: number;
}

export interface CalendarMenuForecastSummary {
  date: string;
  totalQuantity: number;
  totalRevenue: number;
  confidenceLevel: MenuDemandForecastView["basis"]["confidenceLevel"];
  averageWeekdayConfidence: number;
  minSampleCount: number;
  items: CalendarMenuForecastItem[];
}

export function buildCalendarMenuForecastByDate(
  forecasts: readonly MenuDemandForecastView[],
): Map<string, CalendarMenuForecastSummary> {
  const byDate = new Map<string, CalendarMenuForecastSummary>();

  for (const menu of forecasts) {
    for (const day of menu.dailyPredictions) {
      const predictedQuantity = Math.max(0, day.predictedQuantity);
      if (predictedQuantity <= 0) continue;

      const date = localIsoDate(day.date);
      const summary = byDate.get(date) ?? {
        date,
        totalQuantity: 0,
        totalRevenue: 0,
        confidenceLevel: menu.basis.confidenceLevel,
        averageWeekdayConfidence: 0,
        minSampleCount: menu.basis.usableSampleCount,
        items: [],
      };
      const predictedRevenue = predictedQuantity * menu.price;
      summary.totalQuantity += predictedQuantity;
      summary.totalRevenue += predictedRevenue;
      summary.items.push({
        menuId: menu.menuId,
        name: menu.name,
        price: menu.price,
        predictedQuantity,
        predictedRevenue,
        confidenceLevel: menu.basis.confidenceLevel,
        usableSampleCount: menu.basis.usableSampleCount,
        weekdayConfidence: menu.basis.averageWeekdayConfidence,
      });
      byDate.set(date, summary);
    }
  }

  for (const summary of byDate.values()) {
    summary.items.sort((a, b) => b.predictedRevenue - a.predictedRevenue);
    summary.averageWeekdayConfidence =
      summary.items.reduce((sum, item) => sum + item.weekdayConfidence, 0) / summary.items.length;
    summary.minSampleCount = Math.min(...summary.items.map((item) => item.usableSampleCount));
    summary.confidenceLevel = summarizeConfidence(
      summary.items.map((item) => item.confidenceLevel),
    );
  }

  return byDate;
}

function summarizeConfidence(
  levels: readonly MenuDemandForecastView["basis"]["confidenceLevel"][],
): MenuDemandForecastView["basis"]["confidenceLevel"] {
  if (levels.includes("collecting")) return "collecting";
  if (levels.includes("low")) return "low";
  if (levels.includes("medium")) return "medium";
  return "high";
}
