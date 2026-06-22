import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMocks = vi.hoisted(() => ({
  getCalendarMonth: vi.fn(),
  getTodayDashboard: vi.fn(),
  getDepletionForecast: vi.fn(),
  getMenuDemandForecast: vi.fn(),
  applyInventoryReplay: vi.fn(),
  applySaleSnapshotRewrite: vi.fn(),
  savePurchase: vi.fn(),
  saveSale: vi.fn(),
  editSale: vi.fn(),
  deleteSale: vi.fn(),
  saveMenu: vi.fn(),
  editMenu: vi.fn(),
  deleteMenu: vi.fn(),
  saveMenuOptions: vi.fn(),
}));

const forecastMocks = vi.hoisted(() => ({
  forecastIngredient: vi.fn(),
}));

vi.mock("@/lib/supabase/rpc", () => ({
  getCalendarMonth: rpcMocks.getCalendarMonth,
  getTodayDashboard: rpcMocks.getTodayDashboard,
  getDepletionForecast: rpcMocks.getDepletionForecast,
  getMenuDemandForecast: rpcMocks.getMenuDemandForecast,
  applyInventoryReplay: rpcMocks.applyInventoryReplay,
  applySaleSnapshotRewrite: rpcMocks.applySaleSnapshotRewrite,
  savePurchase: rpcMocks.savePurchase,
  saveSale: rpcMocks.saveSale,
  editSale: rpcMocks.editSale,
  deleteSale: rpcMocks.deleteSale,
  saveMenu: rpcMocks.saveMenu,
  editMenu: rpcMocks.editMenu,
  deleteMenu: rpcMocks.deleteMenu,
  saveMenuOptions: rpcMocks.saveMenuOptions,
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
import {
  applyInventoryReplay,
  loadDepletionForecast,
  loadIngredientForecastAccuracyViews,
  loadMenuForecastAccuracyViews,
  loadMenuDemandForecastViews,
  loadMenuBasedIngredientDemandForecast,
} from "@/lib/application/inventory";
import { submitPurchase } from "@/lib/application/purchase";
import {
  applySaleSnapshotRewrite,
  editSale,
  formatSaleErrorMessage,
  submitSale,
} from "@/lib/application/sale";

describe("application layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMocks.getMenuDemandForecast.mockResolvedValue({ data: [], error: null });
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
            leadTimeVendorId: "vendor-1",
            leadTimeVendorName: "신선상회",
            isDefaultLeadTime: false,
            safetyBufferDays: 2,
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
          leadTimeVendorId: "vendor-1",
          leadTimeVendorName: "신선상회",
          isDefaultLeadTime: false,
          safetyBufferDays: 2,
          purchaseCoverageDays: 7,
          expectedDepletionDate: new Date("2026-06-10T00:00:00.000Z"),
          status: "caution",
          trend: "rising",
          isColdStart: false,
          forecastSource: "consumption_history",
          purchaseRecommendation: null,
          basis: {
            model: "hierarchical_weekday",
            usableSampleCount: 1,
            averageWeekdayConfidence: 1 / 13,
            maxWeekdayConfidence: 1 / 13,
            confidenceLevel: "collecting",
          },
        },
      ]);

      expect(forecastMocks.forecastIngredient).toHaveBeenCalledWith({
        currentStock: 1200,
        leadTimeDays: 3,
        safetyBufferDays: 2,
        consumptionSamples: [{ date: new Date("2026-06-01"), amount: 80 }],
        daysOff: ["SUN"],
        signupDate: new Date("2026-05-20T00:00:00.000Z"),
        today: expect.any(Date),
      });
    });

    it("loadDepletionForecast prefers menu-based ingredient demand when available", async () => {
      rpcMocks.getDepletionForecast.mockResolvedValue({
        data: [
          {
            ingredientId: "ice",
            name: "얼음",
            unit: "g",
            currentStock: 100,
            leadTimeDays: 1,
            leadTimeVendorId: "vendor-ice",
            leadTimeVendorName: "얼음상회",
            isDefaultLeadTime: false,
            safetyBufferDays: 1,
            purchaseCoverageDays: 14,
            consumptionSamples: [{ date: "2026-06-01", amount: 1 }],
            signedUpAt: "2026-05-01T00:00:00.000Z",
            regularDaysOff: [],
          },
        ],
        error: null,
      });
      rpcMocks.getMenuDemandForecast.mockResolvedValue({
        data: [
          {
            menuId: "menu-1",
            name: "과일빙수",
            price: 12000,
            isActive: true,
            baseRecipe: [{ ingredientId: "ice", quantityPerServing: 100 }],
            optionGroups: [],
            demandSamples: Array.from({ length: 30 }, (_, index) => ({
              date: `2026-05-${String(index + 1).padStart(2, "0")}`,
              quantity: 10,
            })),
            signedUpAt: "2026-04-01T00:00:00.000Z",
            regularDaysOff: [],
          },
        ],
        error: null,
      });
      forecastMocks.forecastIngredient.mockReturnValue({
        expectedDepletionDate: null,
        status: "safe",
        trend: "normal",
        isColdStart: false,
      });

      const [result] = await loadDepletionForecast({ rpc: {} });

      expect(result?.forecastSource).toBe("menu_demand");
      expect(result?.expectedDepletionDate).toBeInstanceOf(Date);
      expect(result?.status).toBe("critical");
      expect(result?.purchaseRecommendation?.isOrderRecommended).toBe(true);
      expect(result?.purchaseRecommendation?.targetCoverageDays).toBe(14);
      expect(result?.purchaseRecommendation?.recommendedOrderQuantity).toBeGreaterThan(0);
    });

    it("loadDepletionForecast falls back to safety buffer 1 when rpc field is missing", async () => {
      rpcMocks.getDepletionForecast.mockResolvedValue({
        data: [
          {
            ingredientId: "ing-1",
            name: "녹차파우더",
            unit: "g",
            currentStock: 30,
            leadTimeDays: 1,
            leadTimeVendorId: "vendor-powder",
            leadTimeVendorName: "가루상회",
            isDefaultLeadTime: false,
            safetyBufferDays: undefined,
            consumptionSamples: [{ date: "2026-06-01", amount: 10 }],
            signedUpAt: "2026-05-20T00:00:00.000Z",
            regularDaysOff: [],
          },
        ],
        error: null,
      });
      forecastMocks.forecastIngredient.mockReturnValue({
        expectedDepletionDate: new Date("2026-06-10T00:00:00.000Z"),
        status: "critical",
        trend: "falling",
        isColdStart: false,
      });

      await loadDepletionForecast({ rpc: {} });

      expect(forecastMocks.forecastIngredient).toHaveBeenCalledWith({
        currentStock: 30,
        leadTimeDays: 1,
        safetyBufferDays: 1,
        consumptionSamples: [{ date: new Date("2026-06-01"), amount: 10 }],
        daysOff: [],
        signupDate: new Date("2026-05-20T00:00:00.000Z"),
        today: expect.any(Date),
      });
    });

    it("applyInventoryReplay returns applied replay summary", async () => {
      rpcMocks.applyInventoryReplay.mockResolvedValue({
        data: {
          replayRunId: "run-1",
          affectedIngredientCount: 2,
          stockDeltaTotal: -120,
          avgPriceDeltaTotal: 15.5,
        },
        error: null,
      });

      await expect(
        applyInventoryReplay(
          { rpc: {} },
          {
            fromDate: "2026-06-01",
            note: "관리자 재계산",
          },
        ),
      ).resolves.toEqual({
        replayRunId: "run-1",
        affectedIngredientCount: 2,
        stockDeltaTotal: -120,
        avgPriceDeltaTotal: 15.5,
      });
    });

    it("loadMenuBasedIngredientDemandForecast converts menu demand and options into ingredient demand", async () => {
      rpcMocks.getMenuDemandForecast.mockResolvedValue({
        data: [
          {
            menuId: "menu-1",
            name: "과일빙수",
            price: 12000,
            isActive: true,
            baseRecipe: [{ ingredientId: "ice", quantityPerServing: 100 }],
            optionGroups: [
              {
                optionGroupId: "topping",
                name: "토핑",
                selectionType: "add_on",
                isRequired: false,
                values: [
                  {
                    optionValueId: "condensed",
                    name: "연유",
                    isDefault: false,
                    selectionRate: 0.5,
                    recipe: [{ ingredientId: "condensed", quantityPerSelection: 20 }],
                  },
                ],
              },
            ],
            demandSamples: Array.from({ length: 30 }, (_, index) => ({
              date: `2026-05-${String(index + 1).padStart(2, "0")}`,
              quantity: 10,
            })),
            signedUpAt: "2026-04-01T00:00:00.000Z",
            regularDaysOff: [],
          },
        ],
        error: null,
      });

      const result = await loadMenuBasedIngredientDemandForecast({ rpc: {} }, 1);

      expect(result.map((row) => row.ingredientId).sort()).toEqual(["condensed", "ice"]);
      const ice = result.find((row) => row.ingredientId === "ice")?.dailyPredictions[0]?.amount;
      const condensed = result.find((row) => row.ingredientId === "condensed")?.dailyPredictions[0]
        ?.amount;
      expect(ice).toBeGreaterThan(0);
      expect(condensed).toBeCloseTo((ice ?? 0) * 0.1);
    });

    it("loadMenuDemandForecastViews exposes menu demand totals and option rates", async () => {
      rpcMocks.getMenuDemandForecast.mockResolvedValue({
        data: [
          {
            menuId: "menu-1",
            name: "과일빙수",
            price: 12000,
            isActive: true,
            baseRecipe: [{ ingredientId: "ice", quantityPerServing: 100 }],
            optionGroups: [
              {
                optionGroupId: "size",
                name: "사이즈",
                selectionType: "single",
                isRequired: true,
                values: [
                  {
                    optionValueId: "large",
                    name: "라지",
                    isDefault: false,
                    selectionRate: 0.6,
                    recipe: [],
                  },
                  {
                    optionValueId: "regular",
                    name: "레귤러",
                    isDefault: true,
                    selectionRate: 0.4,
                    recipe: [],
                  },
                ],
              },
            ],
            demandSamples: Array.from({ length: 30 }, (_, index) => ({
              date: `2026-05-${String(index + 1).padStart(2, "0")}`,
              quantity: 10,
            })),
            signedUpAt: "2026-04-01T00:00:00.000Z",
            regularDaysOff: [],
          },
        ],
        error: null,
      });

      const [result] = await loadMenuDemandForecastViews({ rpc: {} }, 7);

      expect(result?.menuId).toBe("menu-1");
      expect(result?.dailyPredictions).toHaveLength(7);
      expect(result?.sevenDayTotalQuantity).toBeGreaterThan(0);
      expect(result?.optionGroups[0]?.values.map((value) => value.optionValueId)).toEqual([
        "large",
        "regular",
      ]);
    });

    it("loadMenuForecastAccuracyViews backtests predicted demand against actual sales", async () => {
      rpcMocks.getMenuDemandForecast.mockResolvedValue({
        data: [
          {
            menuId: "menu-1",
            name: "과일빙수",
            price: 12000,
            isActive: true,
            baseRecipe: [],
            optionGroups: [],
            demandSamples: Array.from({ length: 30 }, (_, index) => ({
              date: `2026-05-${String(index + 1).padStart(2, "0")}`,
              quantity: 10,
            })),
            signedUpAt: "2026-04-01T00:00:00.000Z",
            regularDaysOff: [],
          },
        ],
        error: null,
      });

      const [result] = await loadMenuForecastAccuracyViews({ rpc: {} }, 7);

      expect(result?.menuId).toBe("menu-1");
      expect(result?.dailyResults).toHaveLength(7);
      expect(result?.evaluatedDayCount).toBe(7);
      expect(result?.actualTotalQuantity).toBe(70);
      expect(result?.predictedTotalQuantity).toBeGreaterThan(0);
      expect(result?.meanAbsolutePercentageError).not.toBeNull();
      expect(result?.bias).not.toBe("insufficient_data");
    });

    it("loadIngredientForecastAccuracyViews compares ingredient demand forecast with actual consumption", async () => {
      rpcMocks.getMenuDemandForecast.mockResolvedValue({
        data: [
          {
            menuId: "menu-1",
            name: "과일빙수",
            price: 12000,
            isActive: true,
            baseRecipe: [{ ingredientId: "ice", quantityPerServing: 100 }],
            optionGroups: [],
            demandSamples: Array.from({ length: 30 }, (_, index) => ({
              date: `2026-05-${String(index + 1).padStart(2, "0")}`,
              quantity: 10,
            })),
            signedUpAt: "2026-04-01T00:00:00.000Z",
            regularDaysOff: [],
          },
        ],
        error: null,
      });
      rpcMocks.getDepletionForecast.mockResolvedValue({
        data: [
          {
            ingredientId: "ice",
            name: "얼음",
            unit: "g",
            currentStock: 10000,
            leadTimeDays: 1,
            leadTimeVendorId: null,
            leadTimeVendorName: null,
            isDefaultLeadTime: true,
            safetyBufferDays: 1,
            consumptionSamples: Array.from({ length: 30 }, (_, index) => ({
              date: `2026-05-${String(index + 1).padStart(2, "0")}`,
              amount: 1000,
            })),
            signedUpAt: "2026-04-01T00:00:00.000Z",
            regularDaysOff: [],
          },
        ],
        error: null,
      });

      const [result] = await loadIngredientForecastAccuracyViews({ rpc: {} }, 7);

      expect(result?.ingredientId).toBe("ice");
      expect(result?.dailyResults).toHaveLength(7);
      expect(result?.evaluatedDayCount).toBe(7);
      expect(result?.actualTotalAmount).toBe(7000);
      expect(result?.predictedTotalAmount).toBeGreaterThan(0);
      expect(result?.meanAbsolutePercentageError).not.toBeNull();
      expect(result?.bias).not.toBe("insufficient_data");
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
            items: [
              {
                menuId: "menu-1",
                quantity: 3,
                options: [{ optionValueId: "option-1", quantity: 2 }],
              },
            ],
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
            newItems: [
              {
                menuId: "menu-2",
                quantity: 4,
                options: [{ optionValueId: "option-2", quantity: 4 }],
              },
            ],
            reason: "fix count",
          },
        ),
      ).resolves.toEqual({
        totalRevenue: 48000,
        totalCostSnapshot: 19000,
      });

      expect(rpcMocks.saveSale).toHaveBeenCalledWith(
        { rpc: {} },
        {
          soldAt: "2026-06-02",
          items: [
            {
              menuId: "menu-1",
              quantity: 3,
              options: [{ optionValueId: "option-1", quantity: 2 }],
            },
          ],
        },
      );
      expect(rpcMocks.editSale).toHaveBeenCalledWith(
        { rpc: {} },
        {
          saleId: "sale-1",
          newItems: [
            {
              menuId: "menu-2",
              quantity: 4,
              options: [{ optionValueId: "option-2", quantity: 4 }],
            },
          ],
          reason: "fix count",
        },
      );
    });

    it("editSale translates negative_stock into an ingredient-friendly message", async () => {
      rpcMocks.editSale.mockResolvedValue({
        data: null,
        error: {
          message: "negative_stock: ingredient_id=5d012c91-f9a2-4b4f-bbec-a68f06a3efef",
        },
      });
      const client = {
        rpc: {},
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  name: "인절미",
                  unit: "g",
                  current_stock: 0,
                },
                error: null,
              }),
            })),
          })),
        })),
      };

      await expect(
        editSale(client, {
          saleId: "sale-1",
          newItems: [{ menuId: "menu-1", quantity: 1 }],
        }),
      ).rejects.toThrow(
        "인절미 재고가 부족해요. 현재 재고는 0g입니다. 먼저 매입 또는 재고실사로 재고를 채운 뒤 다시 저장해주세요.",
      );
    });

    it("submitSale translates duplicate_sale into an edit-friendly message", async () => {
      rpcMocks.saveSale.mockResolvedValue({
        data: null,
        error: { message: "duplicate_sale" },
      });

      await expect(
        submitSale(
          { rpc: {} },
          {
            soldAt: "2026-06-02",
            items: [{ menuId: "menu-1", quantity: 1 }],
          },
        ),
      ).rejects.toThrow(
        "이미 이 날짜의 판매가 입력되어 있어요. 캘린더 날짜 상세 또는 판매 수정 화면에서 기존 기록을 수정해주세요.",
      );
    });

    it("formatSaleErrorMessage maps schema cache and query errors into friendly messages", () => {
      expect(
        formatSaleErrorMessage(
          "Could not find the table 'public.menu_option_groups' in the schema cache",
        ),
      ).toBe(
        "메뉴 옵션 데이터를 아직 불러오지 못했어요. 데이터베이스 마이그레이션 반영 후 다시 시도해주세요.",
      );
      expect(formatSaleErrorMessage("failed to parse select parameter")).toBe(
        "메뉴 데이터를 읽는 중 오류가 발생했어요. 최신 마이그레이션 반영 후 다시 시도해주세요.",
      );
      expect(formatSaleErrorMessage("menu not found: abc")).toBe(
        "메뉴를 다시 불러오지 못했어요. 새로고침 후 다시 시도해주세요.",
      );
    });

    it("applySaleSnapshotRewrite returns rewrite summary", async () => {
      rpcMocks.applySaleSnapshotRewrite.mockResolvedValue({
        data: {
          replayRunId: "run-2",
          affectedSaleCount: 3,
          affectedItemCount: 8,
          totalCostDelta: 4200.5,
        },
        error: null,
      });

      await expect(
        applySaleSnapshotRewrite(
          { rpc: {} },
          {
            fromDate: "2026-05-01",
            note: "원가 스냅샷 재작성",
          },
        ),
      ).resolves.toEqual({
        replayRunId: "run-2",
        affectedSaleCount: 3,
        affectedItemCount: 8,
        totalCostDelta: 4200.5,
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
      rpcMocks.saveMenuOptions.mockResolvedValue({
        data: [],
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
