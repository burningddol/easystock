import { calculateMargin, calculateMenuCost, type MarginResult } from "@/lib/domain/margin";
import type { Decimal } from "@/lib/domain/_decimal";
import type { RecipeItemForCost } from "@/lib/domain/margin";
import type { MenuRowWithRecipe } from "../hooks/useMenus";

/**
 * `useMenus` join row → 도메인 `RecipeItemForCost[]` 단일 어댑터.
 * compute-menu-margin / sale 스냅샷 변환 두 곳에서 공유.
 */
export function rowToRecipeForCost(row: MenuRowWithRecipe): RecipeItemForCost[] {
  return row.recipe_items.map((item) => ({
    quantity: item.quantity_per_serving,
    avgPrice: item.ingredient.current_avg_price,
  }));
}

export interface MenuMargin {
  cost: Decimal;
  margin: MarginResult;
  hasRecipe: boolean;
}

export function computeMenuMarginFromRow(menu: MenuRowWithRecipe): MenuMargin {
  const recipe = rowToRecipeForCost(menu);
  const cost = calculateMenuCost(recipe);
  const margin = calculateMargin({ price: menu.price, cost });
  // 레시피 비어있으면 cost=0, rate=100% — 호출 측이 hasRecipe로 placeholder 처리.
  return { cost, margin, hasRecipe: recipe.length > 0 };
}
