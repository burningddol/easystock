import type { MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";
import { formatNumber } from "@/lib/utils/format";

interface SaleItemLike {
  menuId: string;
  quantity: number;
}

interface ExistingSaleItemLike {
  menu_id: string;
  quantity: number;
}

export interface StockShortage {
  ingredientId: string;
  name: string;
  unit: string;
  available: number;
  required: number;
  shortage: number;
}

interface FindSaleStockShortagesInput {
  items: readonly SaleItemLike[];
  menus: readonly MenuRowWithRecipe[];
  existingItems?: readonly ExistingSaleItemLike[];
}

export function findSaleStockShortages({
  items,
  menus,
  existingItems = [],
}: FindSaleStockShortagesInput): StockShortage[] {
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));
  const ingredientStock = new Map<string, { name: string; unit: string; currentStock: number }>();
  const required = new Map<string, number>();
  const restored = new Map<string, number>();

  for (const menu of menus) {
    for (const recipeItem of menu.recipe_items) {
      ingredientStock.set(recipeItem.ingredient.id, {
        name: recipeItem.ingredient.name,
        unit: recipeItem.ingredient.unit,
        currentStock: recipeItem.ingredient.current_stock,
      });
    }
  }

  for (const item of items) {
    const menu = menuById.get(item.menuId);
    if (!menu || item.quantity <= 0) continue;

    for (const recipeItem of menu.recipe_items) {
      const consumed = recipeItem.quantity_per_serving * item.quantity;
      required.set(
        recipeItem.ingredient.id,
        (required.get(recipeItem.ingredient.id) ?? 0) + consumed,
      );
    }
  }

  for (const item of existingItems) {
    const menu = menuById.get(item.menu_id);
    if (!menu || item.quantity <= 0) continue;

    for (const recipeItem of menu.recipe_items) {
      const consumed = recipeItem.quantity_per_serving * item.quantity;
      restored.set(
        recipeItem.ingredient.id,
        (restored.get(recipeItem.ingredient.id) ?? 0) + consumed,
      );
    }
  }

  return [...required.entries()]
    .map(([ingredientId, needed]) => {
      const ingredient = ingredientStock.get(ingredientId);
      if (!ingredient) return null;

      const available = ingredient.currentStock + (restored.get(ingredientId) ?? 0);
      const shortage = needed - available;
      if (shortage <= 0) return null;

      return {
        ingredientId,
        name: ingredient.name,
        unit: ingredient.unit,
        available,
        required: needed,
        shortage,
      };
    })
    .filter((item): item is StockShortage => item !== null)
    .sort((a, b) => b.shortage - a.shortage || a.name.localeCompare(b.name, "ko-KR"));
}

export function formatStockShortageMessage(shortages: readonly StockShortage[]): string {
  if (shortages.length === 0) return "";

  const details = shortages.map(
    (item) =>
      `${item.name}: 사용 가능 ${formatStockAmount(item.available)}${item.unit}, 필요 ${formatStockAmount(item.required)}${item.unit}, 부족 ${formatStockAmount(item.shortage)}${item.unit}`,
  );

  return `재고가 부족한 재료가 있어요. ${details.join(" / ")}. 먼저 매입 또는 재고실사로 재고를 채워주세요.`;
}

function formatStockAmount(value: number): string {
  return Number.isInteger(value) ? formatNumber(value) : value.toLocaleString("ko-KR");
}
