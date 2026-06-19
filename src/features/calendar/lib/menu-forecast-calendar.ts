import { localIsoDate } from "@/lib/utils/format";
import type { MenuDemandForecastView } from "@/features/inventory/hooks/useMenuDemandForecast";

export interface CalendarMenuForecastItem {
  menuId: string;
  name: string;
  price: number;
  predictedQuantity: number;
  predictedRevenue: number;
}

export interface CalendarMenuForecastSummary {
  date: string;
  totalQuantity: number;
  totalRevenue: number;
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
      });
      byDate.set(date, summary);
    }
  }

  for (const summary of byDate.values()) {
    summary.items.sort((a, b) => b.predictedRevenue - a.predictedRevenue);
  }

  return byDate;
}
