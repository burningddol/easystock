"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { savePurchase, type SavePurchaseResult } from "@/lib/supabase/rpc";
import { trackEvent } from "@/lib/analytics/ga4";
import { menuListQueryKey } from "@/features/menu/hooks/useMenus";
import { ingredientListQueryKey } from "./useIngredients";
import type { SavePurchaseInput } from "../schemas";

interface SubmitVariables extends SavePurchaseInput {
  isFirstPurchase: boolean;
}

async function submit(input: SubmitVariables): Promise<SavePurchaseResult> {
  const supabase = createClient();
  const { data, error } = await savePurchase(supabase, {
    vendorId: input.vendorId,
    purchasedAt: input.purchasedAt,
    items: input.items,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("save_purchase: empty response");
  return data;
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
      // 매입은 ingredient 단가/재고 갱신 + 메뉴 마진 영향
      void queryClient.invalidateQueries({ queryKey: ingredientListQueryKey });
      void queryClient.invalidateQueries({ queryKey: menuListQueryKey });
    },
  });
}
