"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * MenuForm용 활성 재료 옵션 fetch.
 * `useIngredients` (purchase 슬라이스)는 current_avg_price도 가져오는 무거운 쿼리라
 * 메뉴 작성 폼에선 id/name/unit만 필요한 가벼운 파생 hook을 별도로 둠.
 */

export interface IngredientOption {
  id: string;
  name: string;
  unit: string;
}

export const activeIngredientsQueryKey = ["ingredients", "active-options"] as const;

async function fetchActiveIngredients(): Promise<IngredientOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, unit")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function useActiveIngredients(): UseQueryResult<IngredientOption[]> {
  return useQuery({
    queryKey: activeIngredientsQueryKey,
    queryFn: fetchActiveIngredients,
    staleTime: 60 * 1000,
  });
}
