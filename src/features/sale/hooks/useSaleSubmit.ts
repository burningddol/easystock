"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { saveSale } from "@/lib/supabase/rpc";
import { trackEvent } from "@/lib/analytics/ga4";
import { menuListQueryKey } from "@/features/menu/hooks/useMenus";
import type { SaveSaleInput } from "../schemas";

interface SubmitVariables extends SaveSaleInput {
  isFirstSale: boolean;
}

interface SubmitResult {
  saleId: string;
  totalRevenue: number;
  totalCostSnapshot: number;
  totalNetProfit: number;
  marginPercent: number;
}

async function submit(input: SubmitVariables): Promise<SubmitResult> {
  const supabase = createClient();
  const { data, error } = await saveSale(supabase, {
    soldAt: input.soldAt,
    items: input.items.map((it) => ({ menuId: it.menuId, quantity: it.quantity })),
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("save_sale: no row returned");
  return {
    saleId: row.sale_id,
    totalRevenue: Number(row.total_revenue),
    totalCostSnapshot: Number(row.total_cost_snapshot),
    totalNetProfit: Number(row.total_net_profit),
    marginPercent: Number(row.margin_percent),
  };
}

export function useSaleSubmit(): UseMutationResult<SubmitResult, Error, SubmitVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submit,
    onSuccess: (_result, input) => {
      const today = new Date().toISOString().slice(0, 10);
      const isRetroactive = input.soldAt < today;

      trackEvent("daily_sale_input", { sold_at: input.soldAt });
      if (input.isFirstSale) {
        trackEvent("first_sale_input", {});
      }
      if (isRetroactive) {
        trackEvent("retroactive_sale_complete", { sold_at: input.soldAt });
      }

      void queryClient.invalidateQueries({ queryKey: menuListQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}
