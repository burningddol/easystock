import type { MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";
import {
  computeOptionIngredientRequirements,
  validateMenuOptionSelections,
  type MenuOptionGroupPolicy,
  type MenuOptionSelection,
  type OptionRecipeItem,
} from "@/lib/domain/menu-options";
import { formatNumber } from "@/lib/utils/format";

interface SaleItemOptionLike {
  groupId: string;
  optionValueId: string;
  quantity: number;
}

interface SaleItemLike {
  menuId: string;
  quantity: number;
  options?: readonly SaleItemOptionLike[];
}

interface ExistingSaleItemLike {
  menu_id: string;
  quantity: number;
  options?: readonly SaleItemOptionLike[];
}

export interface StockShortage {
  ingredientId: string;
  name: string;
  unit: string;
  available: number;
  required: number;
  shortage: number;
}

export interface SaleOptionError {
  menuId: string;
  message: string;
}

interface FindSaleStockShortagesInput {
  items: readonly SaleItemLike[];
  menus: readonly MenuRowWithRecipe[];
  existingItems?: readonly ExistingSaleItemLike[];
}

export function findSaleOptionErrors({
  items,
  menus,
}: {
  items: readonly SaleItemLike[];
  menus: readonly MenuRowWithRecipe[];
}): SaleOptionError[] {
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));
  const errors: SaleOptionError[] = [];

  for (const item of items) {
    if (item.quantity <= 0) continue;
    const menu = menuById.get(item.menuId);
    if (!menu || menu.option_groups.length === 0) continue;

    const groups: MenuOptionGroupPolicy[] = menu.option_groups.map((group) => ({
      groupId: group.id,
      selectionType: group.selection_type,
      isRequired: group.is_required,
      minSelect: group.min_select,
      maxSelect: group.max_select,
    }));

    const selections: MenuOptionSelection[] = (item.options ?? []).map((option) => ({
      groupId: option.groupId,
      optionValueId: option.optionValueId,
      quantity: option.quantity,
    }));

    for (const message of validateMenuOptionSelections({
      menuQuantity: item.quantity,
      groups,
      selections,
    })) {
      errors.push({ menuId: item.menuId, message });
    }
  }

  return errors;
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

    for (const group of menu.option_groups) {
      for (const value of group.values) {
        for (const recipeItem of value.recipe_items) {
          ingredientStock.set(recipeItem.ingredient.id, {
            name: recipeItem.ingredient.name,
            unit: recipeItem.ingredient.unit,
            currentStock: recipeItem.ingredient.current_stock,
          });
        }
      }
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

    for (const requirement of computeMenuOptionRequirements(menu, item.options ?? [])) {
      required.set(
        requirement.ingredientId,
        (required.get(requirement.ingredientId) ?? 0) + requirement.quantity,
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

    for (const requirement of computeMenuOptionRequirements(menu, item.options ?? [])) {
      restored.set(
        requirement.ingredientId,
        (restored.get(requirement.ingredientId) ?? 0) + requirement.quantity,
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

function computeMenuOptionRequirements(
  menu: MenuRowWithRecipe,
  selections: readonly SaleItemOptionLike[],
): Array<{ ingredientId: string; quantity: number }> {
  if (menu.option_groups.length === 0 || selections.length === 0) return [];

  const selectionByValue = new Map(
    selections.map((selection) => [selection.optionValueId, selection]),
  );
  const normalizedSelections: MenuOptionSelection[] = [];
  const recipeItems: OptionRecipeItem[] = [];

  for (const group of menu.option_groups) {
    for (const value of group.values) {
      const selection = selectionByValue.get(value.id);
      if (!selection || selection.quantity <= 0) continue;

      normalizedSelections.push({
        groupId: group.id,
        optionValueId: value.id,
        quantity: selection.quantity,
      });

      for (const recipeItem of value.recipe_items) {
        recipeItems.push({
          optionValueId: value.id,
          ingredientId: recipeItem.ingredient.id,
          quantityPerSelection: recipeItem.quantity_per_selection,
        });
      }
    }
  }

  return computeOptionIngredientRequirements({
    selections: normalizedSelections,
    recipeItems,
  });
}

export function formatStockShortageMessage(shortages: readonly StockShortage[]): string {
  if (shortages.length === 0) return "";

  const details = shortages.map(
    (item) =>
      `- ${item.name}: 사용 가능 ${formatStockAmount(item.available)}${item.unit}, 필요 ${formatStockAmount(item.required)}${item.unit}, 부족 ${formatStockAmount(item.shortage)}${item.unit}`,
  );

  return `재고가 부족한 재료가 있어요.\n${details.join("\n")}\n먼저 매입 또는 재고실사로 재고를 채워주세요.`;
}

function formatStockAmount(value: number): string {
  return Number.isInteger(value) ? formatNumber(value) : value.toLocaleString("ko-KR");
}
