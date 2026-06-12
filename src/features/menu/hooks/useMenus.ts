"use client";

import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { loadMenus, type MenuRowWithRecipe } from "@/lib/application/lookups";
import { depletionForecastQueryKey } from "@/features/inventory/hooks/useDepletionForecast";

/**
 * 사용자 메뉴 + 레시피 + 재료 단가를 한 번에 fetch.
 * 메뉴별 원가 계산은 `computeMenuMarginFromRow`가 헌법 III를 적용.
 *
 * `ingredient` non-null: `recipe_items.ingredient_id`는 `on delete restrict`라
 * orphan 불가 (003_menus_and_recipes.sql). Supabase 자동 타입은 보수적으로
 * nullable로 잡지만 fetch 시점에 좁힌다.
 */

export type { MenuRowWithRecipe } from "@/lib/application/lookups";

export const menuListQueryKey = ["menus", "list"] as const;

async function fetchMenus(): Promise<MenuRowWithRecipe[]> {
  const supabase = createClient();
  await (supabase as never as { auth: { getSession: () => Promise<unknown> } }).auth.getSession();
  return loadMenus(supabase as unknown as import("@/lib/application/lookups").LookupClient);
}

export function useMenus(): UseQueryResult<MenuRowWithRecipe[]> {
  return useQuery({
    queryKey: menuListQueryKey,
    queryFn: fetchMenus,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

/**
 * 메뉴 mutation 후 호출 — 메뉴 자체 + 메뉴 마진을 표시하는 dashboard top3 / forecast 화면이
 * 모두 ingredient 단가에 의존하므로 forecast 키도 함께 무효화. menu/sale/purchase mutation
 * 어디서든 같은 패턴 일관 사용.
 */
export function invalidateMenuCaches(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: menuListQueryKey });
  void queryClient.invalidateQueries({ queryKey: depletionForecastQueryKey });
}
