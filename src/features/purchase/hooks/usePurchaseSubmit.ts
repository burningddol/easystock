"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics/ga4";
import { submitPurchase, type SubmitPurchaseInput } from "@/lib/application/purchase";
import type { SavePurchaseResult } from "@/lib/supabase/rpc";
import { calendarQueryKey } from "@/features/calendar/hooks/useCalendarMonth";
import { menuListQueryKey } from "@/features/menu/hooks/useMenus";
import { depletionForecastQueryKey } from "@/features/inventory/hooks/useDepletionForecast";
import { ingredientListQueryKey } from "./useIngredients";
import type { SavePurchaseInput } from "../schemas";

interface SubmitVariables extends SavePurchaseInput {
  isFirstPurchase: boolean;
}

async function submit(input: SubmitVariables): Promise<SavePurchaseResult> {
  const supabase = createClient();
  const payload: SubmitPurchaseInput = {
    vendorId: input.vendorId,
    purchasedAt: input.purchasedAt,
    items: input.items,
  };
  return submitPurchase(supabase, payload);
}

export function usePurchaseSubmit(): UseMutationResult<SavePurchaseResult, Error, SubmitVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submit,
    onSuccess: (result, input) => {
      if (input.isFirstPurchase) {
        trackEvent("first_purchase_logged", {});
      }
      if (result.priceChangeAlerts.length > 0) {
        trackEvent("price_change_alert_shown", {
          alert_count: result.priceChangeAlerts.length,
        });
      }
      // 매입은 가중 이동 평균법으로 ingredient 단가 + 재고 갱신 → 소진 예측 / 메뉴
      // 마진 / 재료 목록 / 캘린더의 hasPurchase 표시 모두 stale. 일관 무효화.
      void queryClient.invalidateQueries({ queryKey: ingredientListQueryKey });
      void queryClient.invalidateQueries({ queryKey: depletionForecastQueryKey });
      void queryClient.invalidateQueries({ queryKey: menuListQueryKey });
      void queryClient.invalidateQueries({ queryKey: calendarQueryKey });
    },
  });
}
