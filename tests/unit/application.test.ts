import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMocks = vi.hoisted(() => ({
  getCalendarMonth: vi.fn(),
  getTodayDashboard: vi.fn(),
  getDepletionForecast: vi.fn(),
  savePurchase: vi.fn(),
  saveSale: vi.fn(),
  editSale: vi.fn(),
  deleteSale: vi.fn(),
  saveMenu: vi.fn(),
  editMenu: vi.fn(),
  deleteMenu: vi.fn(),
}));

const forecastMocks = vi.hoisted(() => ({
  forecastIngredient: vi.fn(),
}));

vi.mock("@/lib/supabase/rpc", () => ({
  getCalendarMonth: rpcMocks.getCalendarMonth,
  getTodayDashboard: rpcMocks.getTodayDashboard,
  getDepletionForecast: rpcMocks.getDepletionForecast,
  savePurchase: rpcMocks.savePurchase,
  saveSale: rpcMocks.saveSale,
  editSale: rpcMocks.editSale,
  deleteSale: rpcMocks.deleteSale,
  saveMenu: rpcMocks.saveMenu,
  editMenu: rpcMocks.editMenu,
  deleteMenu: rpcMocks.deleteMenu,
}));

vi.mock("@/lib/domain/forecast", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/domain/forecast")>("@/lib/domain/forecast");
  return {
    ...actual,
    forecastIngredient: forecastMocks.forecastIngredient,
  };
});

import { createMenu, removeMenu, updateMenu } from "@/lib/application/menu";
import { loadTodayDashboard } from "@/lib/application/dashboard";
import { loadCalendarMonth, withConsecutiveMissingDays } from "@/lib/application/calendar";
import { loadDepletionForecast } from "@/lib/application/inventory";
import { submitPurchase } from "@/lib/application/purchase";
import { editSale, submitSale } from "@/lib/application/sale";

describe("application layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calendar", () => {
    it("withConsecutiveMissingDays counts missing streaks", () => {
      const cells = [
        {
          date: "2026-06-01",
          isFuture: false,
          isBeforeSignup: false,
          isRegularDayOff: false,
          hasSale: false,
          hasPurchase: false,
          isMissing: true,
          revenue: null,
          netProfit: null,
        },
        {
          date: "2026-06-02",
          isFuture: false,
          isBeforeSignup: false,
          isRegularDayOff: false,
          hasSale: false,
          hasPurchase: false,
          isMissing: true,
          revenue: null,
          netProfit: null,
        },
        {
          date: "2026-06-03",
          isFuture: false,
          isBeforeSignup: false,
          isRegularDayOff: false,
          hasSale: true,
          hasPurchase: false,
          isMissing: false,
          revenue: 12000,
          netProfit: 4000,
        },
      ];

      expect(withConsecutiveMissingDays(cells)).toEqual([
        { ...cells[0], consecutiveMissingDays: 1 },
        { ...cells[1], consecutiveMissingDays: 2 },
        { ...cells[2], consecutiveMissingDays: 0 },
      ]);
    });

    it("loadCalendarMonth maps RPC data into calendar view", async () => {
      rpcMocks.getCalendarMonth.mockResolvedValue({
        data: {
          year: 2026,
          month: 6,
          cumulative: {
            totalRevenue: 123000,
            totalNetProfit: 54000,
            avgDailyRevenue: 17642.85,
            operatingDays: 7,
          },
          cells: [
            {
              date: "2026-06-01",
              isFuture: false,
              isBeforeSignup: false,
              isRegularDayOff: false,
              hasSale: false,
              hasPurchase: false,
              isMissing: true,
              revenue: null,
              netProfit: null,
            },
            {
              date: "2026-06-02",
              isFuture: false,
              isBeforeSignup: false,
              isRegularDayOff: false,
              hasSale: true,
              hasPurchase: true,
              isMissing: false,
              revenue: 45000,
              netProfit: 20000,
            },
          ],
          marginLabel: "43.9%",
        },
        error: null,
      });

      await expect(loadCalendarMonth({ rpc: {} }, 2026, 6)).resolves.toEqual({
        year: 2026,
        month: 6,
        cumulative: {
          totalRevenue: 123000,
          totalNetProfit: 54000,
          avgDailyRevenue: 17642.85,
          operatingDays: 7,
        },
        cells: [
          {
            date: "2026-06-01",
            isFuture: false,
            isBeforeSignup: false,
            isRegularDayOff: false,
            hasSale: false,
            hasPurchase: false,
            isMissing: true,
            revenue: null,
            netProfit: null,
            consecutiveMissingDays: 1,
          },
          {
            date: "2026-06-02",
            isFuture: false,
            isBeforeSignup: false,
            isRegularDayOff: false,
            hasSale: true,
            hasPurchase: true,
            isMissing: false,
            revenue: 45000,
            netProfit: 20000,
            consecutiveMissingDays: 0,
          },
        ],
        marginLabel: "43.9%",
      });
    });
  });

  describe("dashboard", () => {
    it("loadTodayDashboard returns data and throws on empty rpc", async () => {
      rpcMocks.getTodayDashboard.mockResolvedValue({
        data: {
          storeName: "지영카페",
          missingYesterdaySale: false,
          yesterday: {
            soldAt: "2026-06-01",
            revenue: 22500,
            netProfit: 18000,
            marginPercent: 80,
            lastWeekRevenue: 30000,
            revenueChangePercent: -25,
          },
          weeklyChart: [{ soldAt: "2026-06-02", revenue: 22500 }],
          expiryAlerts: [],
          top3Menus: [],
          lowMarginMenus: [],
        },
        error: null,
      });

      await expect(loadTodayDashboard({ rpc: {} })).resolves.toEqual({
        storeName: "지영카페",
        missingYesterdaySale: false,
        yesterday: {
          soldAt: "2026-06-01",
          revenue: 22500,
          netProfit: 18000,
          marginPercent: 80,
          lastWeekRevenue: 30000,
          revenueChangePercent: -25,
        },
        weeklyChart: [{ soldAt: "2026-06-02", revenue: 22500 }],
        expiryAlerts: [],
        top3Menus: [],
        lowMarginMenus: [],
      });

      rpcMocks.getTodayDashboard.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(loadTodayDashboard({ rpc: {} })).rejects.toThrow("dashboard data missing");
    });
  });

  describe("inventory", () => {
    it("loadDepletionForecast maps rpc rows through forecastIngredient", async () => {
      rpcMocks.getDepletionForecast.mockResolvedValue({
        data: [
          {
            ingredientId: "ing-1",
            name: "원두",
            unit: "g",
            currentStock: 1200,
            leadTimeDays: 3,
            consumptionSamples: [{ date: "2026-06-01", amount: 80 }],
            signedUpAt: "2026-05-20T00:00:00.000Z",
            regularDaysOff: ["SUN"],
          },
        ],
        error: null,
      });
      forecastMocks.forecastIngredient.mockReturnValue({
        expectedDepletionDate: new Date("2026-06-10T00:00:00.000Z"),
        status: "caution",
        trend: "rising",
        isColdStart: false,
      });

      await expect(loadDepletionForecast({ rpc: {} })).resolves.toEqual([
        {
          ingredientId: "ing-1",
          name: "원두",
          unit: "g",
          currentStock: 1200,
          leadTimeDays: 3,
          expectedDepletionDate: new Date("2026-06-10T00:00:00.000Z"),
          status: "caution",
          trend: "rising",
          isColdStart: false,
        },
      ]);

      expect(forecastMocks.forecastIngredient).toHaveBeenCalledWith({
        currentStock: 1200,
        leadTimeDays: 3,
        consumptionSamples: [{ date: new Date("2026-06-01"), amount: 80 }],
        daysOff: ["SUN"],
        signupDate: new Date("2026-05-20T00:00:00.000Z"),
        today: expect.any(Date),
      });
    });
  });

  describe("purchase", () => {
    it("submitPurchase forwards payload and returns the rpc result", async () => {
      rpcMocks.savePurchase.mockResolvedValue({
        data: {
          purchaseOrderId: "po-1",
          priceChangeAlerts: [
            {
              ingredientId: "ing-1",
              ingredientName: "원두",
              previousAvgPrice: 100,
              newAvgPrice: 120,
              changePercent: 20,
            },
          ],
        },
        error: null,
      });

      await expect(
        submitPurchase(
          {
            rpc: {},
          },
          {
            vendorId: "vendor-1",
            purchasedAt: "2026-06-02",
            items: [{ ingredientId: "ing-1", quantity: 10, amount: 1200 }],
          },
        ),
      ).resolves.toEqual({
        purchaseOrderId: "po-1",
        priceChangeAlerts: [
          {
            ingredientId: "ing-1",
            ingredientName: "원두",
            previousAvgPrice: 100,
            newAvgPrice: 120,
            changePercent: 20,
          },
        ],
      });
    });
  });

  describe("sale", () => {
    it("submitSale and editSale map RPC rows", async () => {
      rpcMocks.saveSale.mockResolvedValue({
        data: [
          {
            sale_id: "sale-1",
            total_revenue: 45000,
            total_cost_snapshot: 18000,
            total_net_profit: 27000,
            margin_percent: 60,
          },
        ],
        error: null,
      });
      rpcMocks.editSale.mockResolvedValue({
        data: [
          {
            sale_id: "sale-1",
            total_revenue: 48000,
            total_cost_snapshot: 19000,
            total_net_profit: 29000,
            margin_percent: 60.42,
          },
        ],
        error: null,
      });

      await expect(
        submitSale(
          { rpc: {} },
          {
            soldAt: "2026-06-02",
            items: [{ menuId: "menu-1", quantity: 3 }],
          },
        ),
      ).resolves.toEqual({
        saleId: "sale-1",
        totalRevenue: 45000,
        totalCostSnapshot: 18000,
        totalNetProfit: 27000,
        marginPercent: 60,
      });

      await expect(
        editSale(
          { rpc: {} },
          {
            saleId: "sale-1",
            newItems: [{ menuId: "menu-2", quantity: 4 }],
            reason: "fix count",
          },
        ),
      ).resolves.toEqual({
        totalRevenue: 48000,
        totalCostSnapshot: 19000,
      });
    });
  });

  describe("menu", () => {
    it("createMenu, updateMenu, and removeMenu use rpc wrappers", async () => {
      rpcMocks.saveMenu.mockResolvedValue({
        data: [{ menu_id: "menu-1" }],
        error: null,
      });
      rpcMocks.editMenu.mockResolvedValue({
        data: [{ menu_id: "menu-1" }],
        error: null,
      });
      rpcMocks.deleteMenu.mockResolvedValue({
        data: [{ menu_id: "menu-1", was_active: false }],
        error: null,
      });

      await expect(
        createMenu(
          { rpc: {} },
          {
            name: "아메리카노",
            price: 4500,
            recipe: [{ ingredientId: "ing-1", quantityPerServing: 18 }],
          },
        ),
      ).resolves.toBe("menu-1");

      await expect(
        updateMenu(
          { rpc: {} },
          {
            menuId: "menu-1",
            name: "아이스 아메리카노",
            price: 4800,
            recipe: [{ ingredientId: "ing-1", quantityPerServing: 20 }],
          },
        ),
      ).resolves.toBe("menu-1");

      await expect(removeMenu({ rpc: {} }, "menu-1")).resolves.toBeUndefined();
    });
  });
});
