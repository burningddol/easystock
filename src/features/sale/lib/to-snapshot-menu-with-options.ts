import type { MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";
import type { MenuForSnapshot } from "@/lib/domain/snapshot";

interface OptionSelectionLike {
  optionValueId: string;
  quantity: number;
}

/**
 * 메뉴 1행의 판매 수량과 옵션 선택을 합친 스냅샷 입력.
 * 옵션 가격/재료는 판매 수량으로 나눈 per-serving 평균으로 환산한다.
 */
export function toSnapshotMenuWithOptions(
  row: MenuRowWithRecipe,
  quantity: number,
  selections: readonly OptionSelectionLike[],
): MenuForSnapshot {
  const baseByIngredient = new Map(
    row.recipe_items.map((item) => [
      item.ingredient.id,
      { quantity: item.quantity_per_serving, avgPrice: item.ingredient.current_avg_price },
    ]),
  );
  const selectionByValueId = new Map(
    selections.map((selection) => [selection.optionValueId, selection.quantity]),
  );
  let totalPriceDelta = 0;

  for (const group of row.option_groups) {
    for (const value of group.values) {
      const selectedQuantity = selectionByValueId.get(value.id) ?? 0;
      if (selectedQuantity <= 0) continue;

      totalPriceDelta += value.price_delta * selectedQuantity;

      for (const recipeItem of value.recipe_items) {
        const current = baseByIngredient.get(recipeItem.ingredient.id);
        const extraPerServing = (recipeItem.quantity_per_selection * selectedQuantity) / quantity;
        baseByIngredient.set(recipeItem.ingredient.id, {
          quantity: (current?.quantity ?? 0) + extraPerServing,
          avgPrice: recipeItem.ingredient.current_avg_price,
        });
      }
    }
  }

  return {
    id: row.id,
    name: row.name,
    price: row.price + totalPriceDelta / quantity,
    recipeItems: [...baseByIngredient.entries()]
      .map(([ingredientId, item]) => ({
        quantity: item.quantity,
        avgPrice: item.avgPrice,
      }))
      .sort((a, b) => a.avgPrice - b.avgPrice || a.quantity - b.quantity),
  };
}
