import type { MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";
import type { MenuForSnapshot } from "@/lib/domain/snapshot";

/**
 * `useMenus`의 join row를 도메인 함수가 받는 형태로 어댑트.
 * 같은 메뉴 데이터가 두 표현(DB column / 도메인 입력) 사이를 오갈 때 변환 단일 출처.
 */
export function toSnapshotMenu(row: MenuRowWithRecipe): MenuForSnapshot {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    recipeItems: row.recipe_items.map((it) => ({
      quantity: it.quantity_per_serving,
      avgPrice: it.ingredient.current_avg_price,
    })),
  };
}
