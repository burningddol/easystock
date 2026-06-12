export type MenuOptionSelectionType = "single" | "add_on";

export interface MenuOptionGroupPolicy {
  groupId: string;
  selectionType: MenuOptionSelectionType;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number | null;
}

export interface MenuOptionSelection {
  optionValueId: string;
  groupId: string;
  quantity: number;
}

export interface OptionRecipeItem {
  optionValueId: string;
  ingredientId: string;
  quantityPerSelection: number;
}

export interface OptionIngredientRequirement {
  ingredientId: string;
  quantity: number;
}

export function validateMenuOptionSelections({
  menuQuantity,
  groups,
  selections,
}: {
  menuQuantity: number;
  groups: readonly MenuOptionGroupPolicy[];
  selections: readonly MenuOptionSelection[];
}): string[] {
  const errors: string[] = [];
  const quantitiesByGroup = new Map<string, number>();

  for (const selection of selections) {
    if (!Number.isInteger(selection.quantity) || selection.quantity <= 0) {
      errors.push(`invalid_option_quantity:${selection.optionValueId}`);
      continue;
    }
    quantitiesByGroup.set(
      selection.groupId,
      (quantitiesByGroup.get(selection.groupId) ?? 0) + selection.quantity,
    );
  }

  for (const group of groups) {
    const selectedQuantity = quantitiesByGroup.get(group.groupId) ?? 0;

    if (group.isRequired && selectedQuantity < menuQuantity) {
      errors.push(`required_option_missing:${group.groupId}`);
    }
    if (selectedQuantity < group.minSelect) {
      errors.push(`option_min_not_met:${group.groupId}`);
    }
    if (group.maxSelect !== null && selectedQuantity > group.maxSelect * menuQuantity) {
      errors.push(`option_max_exceeded:${group.groupId}`);
    }
    if (
      group.selectionType === "single" &&
      selectedQuantity !== 0 &&
      selectedQuantity !== menuQuantity
    ) {
      errors.push(`single_option_must_match_menu_quantity:${group.groupId}`);
    }
  }

  return errors;
}

export function computeOptionIngredientRequirements({
  selections,
  recipeItems,
}: {
  selections: readonly MenuOptionSelection[];
  recipeItems: readonly OptionRecipeItem[];
}): OptionIngredientRequirement[] {
  const selectionQuantityByValue = new Map<string, number>();
  for (const selection of selections) {
    selectionQuantityByValue.set(
      selection.optionValueId,
      (selectionQuantityByValue.get(selection.optionValueId) ?? 0) + selection.quantity,
    );
  }

  const requiredByIngredient = new Map<string, number>();
  for (const recipeItem of recipeItems) {
    const selectionQuantity = selectionQuantityByValue.get(recipeItem.optionValueId) ?? 0;
    if (selectionQuantity <= 0) continue;

    requiredByIngredient.set(
      recipeItem.ingredientId,
      (requiredByIngredient.get(recipeItem.ingredientId) ?? 0) +
        recipeItem.quantityPerSelection * selectionQuantity,
    );
  }

  return [...requiredByIngredient.entries()]
    .map(([ingredientId, quantity]) => ({ ingredientId, quantity }))
    .sort((a, b) => a.ingredientId.localeCompare(b.ingredientId));
}
