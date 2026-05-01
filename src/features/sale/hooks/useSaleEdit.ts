"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { editSale, deleteSale } from "@/lib/supabase/rpc";
import { trackEvent } from "@/lib/analytics/ga4";
import { ingredientListQueryKey } from "@/features/purchase/hooks/useIngredients";
import { depletionForecastQueryKey } from "@/features/inventory/hooks/useDepletionForecast";
import { salesQueryKey } from "./_keys";
import type { EditSaleInput } from "../schemas";

interface EditResult {
  totalRevenue: number;
  totalCostSnapshot: number;
}

async function edit(input: EditSaleInput): Promise<EditResult> {
  const supabase = createClient();
  const { data, error } = await editSale(supabase, {
    saleId: input.saleId,
    newItems: input.newItems.map((it) => ({ menuId: it.menuId, quantity: it.quantity })),
    reason: input.reason,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("edit_sale: no row");
  return {
    totalRevenue: Number(row.total_revenue),
    totalCostSnapshot: Number(row.total_cost_snapshot),
  };
}

async function remove(saleId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await deleteSale(supabase, saleId);
  if (error) throw new Error(error.message);
}

// sale 편집/삭제도 재료 재고 보정 + price_history insert를 RPC가 수행하므로 sale 키
// 단독 무효화는 inventory 페이지 stale을 만든다 (useSaleSubmit과 동일 패턴).
function invalidateSaleAndIngredientCaches(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: salesQueryKey });
  void queryClient.invalidateQueries({ queryKey: ingredientListQueryKey });
  void queryClient.invalidateQueries({ queryKey: depletionForecastQueryKey });
}

export function useSaleEdit(): UseMutationResult<EditResult, Error, EditSaleInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: edit,
    onSuccess: () => {
      trackEvent("sale_edited", {});
      invalidateSaleAndIngredientCaches(queryClient);
    },
  });
}

export function useSaleDelete(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: remove,
    onSuccess: () => invalidateSaleAndIngredientCaches(queryClient),
  });
}
