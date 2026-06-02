"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics/ga4";
import { requestPushPermissionAndSubscribe } from "@/lib/push/client";
import { submitSale, type SubmitSaleInput, type SubmitSaleResult } from "@/lib/application/sale";
import { menuListQueryKey } from "@/features/menu/hooks/useMenus";
import { ingredientListQueryKey } from "@/features/purchase/hooks/useIngredients";
import { depletionForecastQueryKey } from "@/features/inventory/hooks/useDepletionForecast";
import { salesQueryKey } from "./_keys";
import type { SaveSaleInput } from "../schemas";

interface SubmitVariables extends SaveSaleInput {
  isFirstSale: boolean;
}

async function submit(input: SubmitVariables): Promise<SubmitSaleResult> {
  const supabase = createClient();
  const payload: SubmitSaleInput = {
    soldAt: input.soldAt,
    items: input.items,
  };
  return submitSale(supabase, payload);
}

export function useSaleSubmit(): UseMutationResult<SubmitSaleResult, Error, SubmitVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submit,
    onSuccess: (_result, input) => {
      const today = new Date().toISOString().slice(0, 10);
      const isRetroactive = input.soldAt < today;

      trackEvent("daily_sale_input", { sold_at: input.soldAt });
      if (input.isFirstSale) {
        trackEvent("first_sale_input", {});
        // R1: 첫 가치 경험 직후에 푸시 권한 요청 (T137).
        // 실패해도 sale 저장 흐름엔 영향 없음 (best-effort).
        void requestPushPermissionAndSubscribe();
      }
      if (isRetroactive) {
        trackEvent("retroactive_sale_complete", { sold_at: input.soldAt });
      }

      // sale 저장은 재료 재고 차감 + 단가 history insert까지 트리거 → menu 캐시 외에
      // ingredient/forecast도 함께 무효화해야 inventory 페이지가 즉시 반영.
      void queryClient.invalidateQueries({ queryKey: menuListQueryKey });
      void queryClient.invalidateQueries({ queryKey: ingredientListQueryKey });
      void queryClient.invalidateQueries({ queryKey: depletionForecastQueryKey });
      void queryClient.invalidateQueries({ queryKey: salesQueryKey });
    },
  });
}
