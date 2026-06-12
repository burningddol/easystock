import { describe, expect, it, vi } from "vitest";
import { loadIngredients, loadMenus, loadSaleByDate, loadVendors } from "@/lib/application/lookups";

type RpcResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

function createClientMock(results: Record<string, RpcResponse<unknown>>) {
  return {
    from: vi.fn((table: string) => {
      const response = results[table] ?? { data: [], error: null };
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(async () => response),
        maybeSingle: vi.fn(async () => response),
      };
      return chain;
    }),
  };
}

describe("query lookups", () => {
  it("loadMenus maps nested ingredient rows", async () => {
    const client = createClientMock({
      menus: {
        data: [
          {
            id: "menu-1",
            name: "아메리카노",
            price: "4500",
            is_active: true,
            recipe_items: [
              {
                id: "ri-1",
                quantity_per_serving: 18,
                ingredient: {
                  id: "ing-1",
                  name: "원두",
                  unit: "g",
                  current_stock: "1000",
                  current_avg_price: "50",
                },
              },
              {
                id: "ri-2",
                quantity_per_serving: 10,
                ingredient: null,
              },
            ],
            option_groups: [],
          },
        ],
        error: null,
      },
      menu_option_groups: { data: [], error: null },
      menu_option_values: { data: [], error: null },
      menu_option_value_recipe_items: { data: [], error: null },
    });

    await expect(loadMenus(client)).resolves.toEqual([
      {
        id: "menu-1",
        name: "아메리카노",
        price: 4500,
        is_active: true,
        recipe_items: [
          {
            id: "ri-1",
            quantity_per_serving: 18,
            ingredient: {
              id: "ing-1",
              name: "원두",
              unit: "g",
              current_stock: 1000,
              current_avg_price: 50,
            },
          },
        ],
        option_groups: [],
      },
    ]);
  });

  it("loadVendors normalizes numeric lead time", async () => {
    const client = createClientMock({
      vendors: {
        data: [
          {
            id: "vendor-1",
            name: "서울상사",
            lead_time_days: "3",
          },
        ],
        error: null,
      },
    });

    await expect(loadVendors(client)).resolves.toEqual([
      {
        id: "vendor-1",
        name: "서울상사",
        lead_time_days: 3,
      },
    ]);
  });

  it("loadIngredients normalizes numeric average price", async () => {
    const client = createClientMock({
      ingredients: {
        data: [
          {
            id: "ing-1",
            name: "원두",
            unit: "g",
            current_avg_price: "52.5",
          },
        ],
        error: null,
      },
    });

    await expect(loadIngredients(client)).resolves.toEqual([
      {
        id: "ing-1",
        name: "원두",
        unit: "g",
        current_avg_price: 52.5,
      },
    ]);
  });

  it("loadSaleByDate maps nested sale items and null stays null", async () => {
    const client = createClientMock({
      sales: {
        data: {
          id: "sale-1",
          sold_at: "2026-06-02",
          created_at: "2026-06-02T03:00:00.000Z",
          total_revenue: "45000",
          total_cost_snapshot: "18000",
          sale_items: [
            {
              id: "si-1",
              menu_id: "menu-1",
              menu: { name: "아메리카노" },
              quantity: 3,
              unit_price: "15000",
              menu_cost_snapshot: "6000",
            },
          ],
        },
        error: null,
      },
    });

    await expect(loadSaleByDate(client, "2026-06-02")).resolves.toEqual({
      id: "sale-1",
      sold_at: "2026-06-02",
      created_at: "2026-06-02T03:00:00.000Z",
      total_revenue: 45000,
      total_cost_snapshot: 18000,
      items: [
        {
          id: "si-1",
          menu_id: "menu-1",
          menu_name: "아메리카노",
          quantity: 3,
          unit_price: 15000,
          menu_cost_snapshot: 6000,
          options: [],
        },
      ],
    });

    const emptyClient = createClientMock({
      sales: {
        data: null,
        error: null,
      },
    });

    await expect(loadSaleByDate(emptyClient, "2026-06-03")).resolves.toBeNull();
  });
});
