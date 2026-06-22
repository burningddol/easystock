"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics/ga4";
import { invalidatePurchaseWriteRelatedQueries } from "@/lib/query-invalidation";
import { submitPurchase, type SubmitPurchaseInput } from "@/lib/application/purchase";
import {
  linkOrderRecommendationSnapshotPurchase,
  type SavePurchaseResult,
} from "@/lib/supabase/rpc";
import type { SavePurchaseInput } from "../schemas";

interface SubmitVariables extends SavePurchaseInput {
  isFirstPurchase: boolean;
  recommendationSnapshotId?: string | null;
}

async function submit(input: SubmitVariables): Promise<SavePurchaseResult> {
  const supabase = createClient();
  const payload: SubmitPurchaseInput = {
    vendorId: input.vendorId,
    purchasedAt: input.purchasedAt,
    items: input.items,
  };
  const result = await submitPurchase(supabase, payload);
  if (input.recommendationSnapshotId) {
    await linkOrderRecommendationSnapshotPurchase(supabase, {
      snapshotId: input.recommendationSnapshotId,
      purchaseOrderId: result.purchaseOrderId,
    });
  }
  return result;
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
      invalidatePurchaseWriteRelatedQueries(queryClient);
    },
  });
}
