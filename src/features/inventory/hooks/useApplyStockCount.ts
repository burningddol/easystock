"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { applyStockCount, type ApplyStockCountResult } from "@/lib/supabase/rpc";
import { trackEvent } from "@/lib/analytics/ga4";
import { ingredientListQueryKey } from "@/features/purchase/hooks/useIngredients";
import { menuListQueryKey } from "@/features/menu/hooks/useMenus";
import { depletionForecastQueryKey } from "./useDepletionForecast";
import type { ApplyStockCountInput } from "../schemas";

async function submit(input: ApplyStockCountInput): Promise<ApplyStockCountResult> {
  const supabase = createClient();
  const { data, error } = await applyStockCount(supabase, {
    countedAt: input.countedAt,
    items: input.items,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("apply_stock_count: empty response");
  return data;
}

export function useApplyStockCount(): UseMutationResult<
  ApplyStockCountResult,
  Error,
  ApplyStockCountInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submit,
    onSuccess: (result) => {
      trackEvent("stock_count_completed", {
        loss_amount: result.weeklyLossAmount,
        item_count: result.itemDifferences.length,
      });
      void queryClient.invalidateQueries({ queryKey: ingredientListQueryKey });
      void queryClient.invalidateQueries({ queryKey: depletionForecastQueryKey });
      void queryClient.invalidateQueries({ queryKey: menuListQueryKey });
    },
  });
}
