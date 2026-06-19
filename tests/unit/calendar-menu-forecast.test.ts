import { describe, expect, it } from "vitest";
import { buildCalendarMenuForecastByDate } from "@/features/calendar/lib/menu-forecast-calendar";
import type { MenuDemandForecastView } from "@/features/inventory/hooks/useMenuDemandForecast";

describe("calendar menu forecast summary", () => {
  it("groups menu demand forecasts by date and sums revenue", () => {
    const forecasts: MenuDemandForecastView[] = [
      {
        menuId: "menu-1",
        name: "딸기빙수",
        price: 11_000,
        tomorrowQuantity: 2,
        sevenDayTotalQuantity: 2,
        trend: "normal",
        isColdStart: false,
        dailyPredictions: [{ date: new Date("2026-06-20T00:00:00"), predictedQuantity: 2 }],
        optionGroups: [],
      },
      {
        menuId: "menu-2",
        name: "망고빙수",
        price: 12_000,
        tomorrowQuantity: 1.5,
        sevenDayTotalQuantity: 1.5,
        trend: "normal",
        isColdStart: false,
        dailyPredictions: [{ date: new Date("2026-06-20T00:00:00"), predictedQuantity: 1.5 }],
        optionGroups: [],
      },
    ];

    const summary = buildCalendarMenuForecastByDate(forecasts).get("2026-06-20");

    expect(summary?.totalQuantity).toBe(3.5);
    expect(summary?.totalRevenue).toBe(40_000);
    expect(summary?.items.map((item) => item.name)).toEqual(["딸기빙수", "망고빙수"]);
  });
});
