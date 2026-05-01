import type { MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";
import { rowToRecipeForCost } from "@/features/menu/lib/compute-menu-margin";
import type { MenuForSnapshot } from "@/lib/domain/snapshot";

/**
 * `useMenus`의 join row를 sale 스냅샷 도메인 입력으로 어댑트.
 * recipe 매핑은 compute-menu-margin과 공유 (rowToRecipeForCost).
 */
export function toSnapshotMenu(row: MenuRowWithRecipe): MenuForSnapshot {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    recipeItems: rowToRecipeForCost(row),
  };
}
