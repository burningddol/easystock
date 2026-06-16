import { describe, it, expect } from "vitest";
import { computeMenuMarginFromRow } from "@/features/menu/lib/compute-menu-margin";
import { toSnapshotMenu } from "@/features/sale/lib/to-snapshot-menu";
import type { MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";

const baseMenu = (overrides?: Partial<MenuRowWithRecipe>): MenuRowWithRecipe => ({
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
  ...overrides,
  option_groups: overrides?.option_groups ?? [],
});

describe("computeMenuMarginFromRow", () => {
  it("레시피 있는 메뉴 — cost / margin / hasRecipe 계산 (헌법 III 이동평균법)", () => {
    const menu = baseMenu();
    const result = computeMenuMarginFromRow(menu);

    // 18g × 50원 = 900 원가
    expect(result.cost.toNumber()).toBe(900);
    // margin = 4500 - 900 = 3600, rate = 80%
    expect(result.margin.amount.toNumber()).toBe(3600);
    expect(result.margin.rate.toNumber()).toBe(80);
    expect(result.hasRecipe).toBe(true);
  });

  it("레시피 비어있으면 cost=0, hasRecipe=false (호출 측이 placeholder 처리)", () => {
    const menu = baseMenu({ recipe_items: [] });
    const result = computeMenuMarginFromRow(menu);

    expect(result.cost.toNumber()).toBe(0);
    expect(result.hasRecipe).toBe(false);
    // 가격 그대로 = 마진. rate는 100% (placeholder)
    expect(result.margin.amount.toNumber()).toBe(4500);
    expect(result.margin.rate.toNumber()).toBe(100);
  });
});

describe("toSnapshotMenu", () => {
  it("DB row → 도메인 입력 형태 어댑트", () => {
    const menu = baseMenu();
    const snapshot = toSnapshotMenu(menu);

    expect(snapshot.id).toBe("menu-1");
    expect(snapshot.name).toBe("아메리카노");
    expect(snapshot.price).toBe(4500);
    expect(snapshot.recipeItems).toEqual([{ quantity: 18, avgPrice: 50 }]);
  });

  it("recipe 비어있으면 빈 배열", () => {
    const snapshot = toSnapshotMenu(baseMenu({ recipe_items: [] }));
    expect(snapshot.recipeItems).toEqual([]);
  });
});
