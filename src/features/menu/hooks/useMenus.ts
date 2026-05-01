"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * 사용자 메뉴 + 레시피 + 재료 단가를 한 번에 fetch.
 * 메뉴별 원가 계산은 `computeMenuMarginFromRow`가 헌법 III를 적용.
 *
 * `ingredient` non-null: `recipe_items.ingredient_id`는 `on delete restrict`라
 * orphan 불가 (003_menus_and_recipes.sql). Supabase 자동 타입은 보수적으로
 * nullable로 잡지만 fetch 시점에 좁힌다.
 */

interface RawIngredient {
  id: string;
  name: string;
  unit: string;
  current_avg_price: number;
}

interface RawRecipeItem {
  id: string;
  quantity_per_serving: number;
  ingredient: RawIngredient | null;
}

export interface MenuRowWithRecipe {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  recipe_items: Array<{
    id: string;
    quantity_per_serving: number;
    ingredient: RawIngredient;
  }>;
}

export const menuListQueryKey = ["menus", "list"] as const;

interface RawMenuRow {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  recipe_items: RawRecipeItem[];
}

async function fetchMenus(): Promise<MenuRowWithRecipe[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("menus")
    .select(
      `
      id, name, price, is_active,
      recipe_items (
        id,
        quantity_per_serving,
        ingredient:ingredients (
          id, name, unit, current_avg_price
        )
      )
    `,
    )
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }
  const rows = (data ?? []) as unknown as RawMenuRow[];
  return rows.map((menu) => ({
    id: menu.id,
    name: menu.name,
    price: menu.price,
    is_active: menu.is_active,
    recipe_items: menu.recipe_items.filter(
      (item): item is RawRecipeItem & { ingredient: RawIngredient } => item.ingredient !== null,
    ),
  }));
}

export function useMenus(): UseQueryResult<MenuRowWithRecipe[]> {
  return useQuery({
    queryKey: menuListQueryKey,
    queryFn: fetchMenus,
  });
}
