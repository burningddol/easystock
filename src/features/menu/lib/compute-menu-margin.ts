import { calculateMargin, calculateMenuCost, type MarginResult } from "@/lib/domain/margin";
import type { Decimal } from "@/lib/domain/_decimal";
import type { MenuRowWithRecipe } from "../hooks/useMenus";

/**
 * `useMenus`가 반환하는 row 형태에서 직접 원가 + 마진을 산출.
 * MenuList / MenuDetailCard / 후속 dashboard top-3 / sale 미리보기에서 공유.
 *
 * 레시피가 비어 있으면 `cost = 0`이므로 `rate = 100%`가 나오는데,
 * 그건 호출 측이 "레시피 미등록" placeholder로 처리하는 게 자연스럽다.
 * 여기서는 raw 계산만 하고 의미 부여는 UI에 위임.
 */

export interface MenuMargin {
  cost: Decimal;
  margin: MarginResult;
  hasRecipe: boolean;
}

export function computeMenuMarginFromRow(menu: MenuRowWithRecipe): MenuMargin {
  const recipe = menu.recipe_items.map((item) => ({
    quantity: item.quantity_per_serving,
    avgPrice: item.ingredient.current_avg_price,
  }));
  const cost = calculateMenuCost(recipe);
  const margin = calculateMargin({ price: menu.price, cost });
  return { cost, margin, hasRecipe: recipe.length > 0 };
}
