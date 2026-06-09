import { describe, expect, it } from "vitest";
import {
  findSaleStockShortages,
  formatStockShortageMessage,
} from "@/features/sale/lib/stock-guard";
import type { MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";

const menus: MenuRowWithRecipe[] = [
  {
    id: "menu-1",
    name: "인절미빙수",
    price: 12000,
    is_active: true,
    recipe_items: [
      {
        id: "recipe-1",
        quantity_per_serving: 60,
        ingredient: {
          id: "ing-1",
          name: "인절미",
          unit: "g",
          current_stock: 0,
          current_avg_price: 50,
        },
      },
    ],
  },
  {
    id: "menu-2",
    name: "팥빙수",
    price: 11000,
    is_active: true,
    recipe_items: [
      {
        id: "recipe-2",
        quantity_per_serving: 40,
        ingredient: {
          id: "ing-2",
          name: "팥",
          unit: "g",
          current_stock: 200,
          current_avg_price: 20,
        },
      },
    ],
  },
];

describe("sale stock guard", () => {
  it("finds shortages for initial sale save", () => {
    const shortages = findSaleStockShortages({
      items: [{ menuId: "menu-1", quantity: 1 }],
      menus,
    });

    expect(shortages).toEqual([
      {
        ingredientId: "ing-1",
        name: "인절미",
        unit: "g",
        available: 0,
        required: 60,
        shortage: 60,
      },
    ]);
  });

  it("allows edit when existing sale stock would be restored first", () => {
    const shortages = findSaleStockShortages({
      items: [{ menuId: "menu-1", quantity: 1 }],
      menus,
      existingItems: [{ menu_id: "menu-1", quantity: 1 }],
    });

    expect(shortages).toEqual([]);
  });

  it("formats a friendly shortage message", () => {
    const message = formatStockShortageMessage([
      {
        ingredientId: "ing-1",
        name: "인절미",
        unit: "g",
        available: 0,
        required: 60,
        shortage: 60,
      },
    ]);

    expect(message).toBe(
      "재고가 부족한 재료가 있어요.\n- 인절미: 사용 가능 0g, 필요 60g, 부족 60g\n먼저 매입 또는 재고실사로 재고를 채워주세요.",
    );
  });

  it("lists every shortage in the message", () => {
    const message = formatStockShortageMessage([
      {
        ingredientId: "ing-1",
        name: "인절미",
        unit: "g",
        available: 0,
        required: 60,
        shortage: 60,
      },
      {
        ingredientId: "ing-2",
        name: "팥",
        unit: "g",
        available: 10,
        required: 40,
        shortage: 30,
      },
    ]);

    expect(message).toBe(
      "재고가 부족한 재료가 있어요.\n- 인절미: 사용 가능 0g, 필요 60g, 부족 60g\n- 팥: 사용 가능 10g, 필요 40g, 부족 30g\n먼저 매입 또는 재고실사로 재고를 채워주세요.",
    );
  });
});
