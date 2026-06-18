"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { localIsoDate } from "@/lib/utils/format";
import {
  saveOrderRecommendationSnapshot,
  type SaveOrderRecommendationSnapshotInput,
} from "@/lib/supabase/rpc";
import type { IngredientForecastView } from "@/lib/application/inventory";

interface SaveOrderRecommendationSnapshotVariables {
  vendorId: string | null;
  items: readonly IngredientForecastView[];
}

function toSnapshotInput(
  variables: SaveOrderRecommendationSnapshotVariables,
): SaveOrderRecommendationSnapshotInput {
  return {
    vendorId: variables.vendorId,
    source: "inventory_orders",
    items: variables.items.flatMap((item) => {
      const recommendation = item.purchaseRecommendation;
      if (!recommendation?.isOrderRecommended) return [];
      return [
        {
          ingredientId: item.ingredientId,
          recommendedQuantity: Math.ceil(recommendation.recommendedOrderQuantity),
          currentStock: item.currentStock,
          expectedDepletionDate: item.expectedDepletionDate
            ? localIsoDate(item.expectedDepletionDate)
            : null,
          orderByDate: recommendation.orderByDate ? localIsoDate(recommendation.orderByDate) : null,
          leadTimeDays: item.leadTimeDays,
          safetyBufferDays: item.safetyBufferDays,
          purchaseCoverageDays: recommendation.targetCoverageDays,
        },
      ];
    }),
  };
}

async function saveSnapshot(variables: SaveOrderRecommendationSnapshotVariables): Promise<string> {
  const supabase = createClient();
  const { data, error } = await saveOrderRecommendationSnapshot(
    supabase,
    toSnapshotInput(variables),
  );
  if (error) throw new Error(error.message);
  const snapshotId = data?.[0]?.snapshot_id;
  if (!snapshotId) throw new Error("발주 추천 스냅샷 저장 결과가 비어 있습니다.");
  return snapshotId;
}

export function useOrderRecommendationSnapshot(): UseMutationResult<
  string,
  Error,
  SaveOrderRecommendationSnapshotVariables
> {
  return useMutation({ mutationFn: saveSnapshot });
}
