"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { cloneMenuTemplate } from "@/lib/supabase/rpc";
import { trackEvent } from "@/lib/analytics/ga4";
import { ingredientListQueryKey } from "@/features/purchase/hooks/useIngredients";
import { invalidateMenuCaches } from "./useMenus";
import type { CloneTemplateInput } from "../schemas";

interface CloneResult {
  newMenuCount: number;
  newIngredientCount: number;
}

async function clone(input: CloneTemplateInput): Promise<CloneResult> {
  const supabase = createClient();
  const { data, error } = await cloneMenuTemplate(supabase, { storeType: input.storeType });

  if (error) {
    throw new Error(error.message);
  }

  const row = data?.[0];
  return {
    newMenuCount: row?.menu_ids.length ?? 0,
    newIngredientCount: row?.ingredient_ids.length ?? 0,
  };
}

export function useCloneTemplate(): UseMutationResult<CloneResult, Error, CloneTemplateInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clone,
    onSuccess: (result, input) => {
      trackEvent("template_loaded", {
        store_type: input.storeType,
        new_menus: result.newMenuCount,
      });
      invalidateMenuCaches(queryClient);
      // 템플릿은 메뉴 + 재료를 함께 생성 → 재료 목록도 무효화.
      void queryClient.invalidateQueries({ queryKey: ingredientListQueryKey });
    },
  });
}
