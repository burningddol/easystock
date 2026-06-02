"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics/ga4";
import {
  editSale as editSaleUseCase,
  removeSale,
  type EditSaleInput as EditSaleUseCaseInput,
  type EditSaleResult,
  type SaleClient,
} from "@/lib/application/sale";
import { ingredientListQueryKey } from "@/features/purchase/hooks/useIngredients";
import { depletionForecastQueryKey } from "@/features/inventory/hooks/useDepletionForecast";
import { salesQueryKey } from "./_keys";

async function edit(input: EditSaleUseCaseInput): Promise<EditSaleResult> {
  const supabase = createClient() as unknown as SaleClient;
  return editSaleUseCase(supabase, input);
}

// sale 편집/삭제도 재료 재고 보정 + price_history insert를 RPC가 수행하므로 sale 키
// 단독 무효화는 inventory 페이지 stale을 만든다 (useSaleSubmit과 동일 패턴).
function invalidateSaleAndIngredientCaches(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: salesQueryKey });
  void queryClient.invalidateQueries({ queryKey: ingredientListQueryKey });
  void queryClient.invalidateQueries({ queryKey: depletionForecastQueryKey });
}

export function useSaleEdit(): UseMutationResult<EditSaleResult, Error, EditSaleUseCaseInput> {
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
    mutationFn: async (saleId) => {
      const supabase = createClient() as unknown as SaleClient;
      return removeSale(supabase, saleId);
    },
    onSuccess: () => invalidateSaleAndIngredientCaches(queryClient),
  });
}
