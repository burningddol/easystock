"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { applyStockCount, type ApplyStockCountResult } from "@/lib/supabase/rpc";
import { trackEvent } from "@/lib/analytics/ga4";
import { ingredientListQueryKey } from "@/features/purchase/hooks/useIngredients";
import { invalidateMenuCaches } from "@/features/menu/hooks/useMenus";
import type { ApplyStockCountInput } from "../schemas";

async function submit(input: ApplyStockCountInput): Promise<ApplyStockCountResult> {
  const supabase = createClient();
  const { data, error } = await applyStockCount(supabase, {
    countedAt: input.countedAt,
    items: input.items,
  });
  if (error) {
    if (error.code === "23505" && error.message.includes("stock_counts_one_per_day_per_user")) {
      throw new Error(
        "같은 날짜 재고 실사가 이미 저장되어 있어요. 현재 환경 DB에 수정용 마이그레이션이 아직 적용되지 않았을 수 있습니다.",
      );
    }
    throw new Error(error.message);
  }
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
      // invalidateMenuCaches가 menu + forecast 둘 다 처리. 재료 목록만 추가.
      void queryClient.invalidateQueries({ queryKey: ingredientListQueryKey });
      invalidateMenuCaches(queryClient);
    },
  });
}
