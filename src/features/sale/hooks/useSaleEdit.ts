"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { editSale, deleteSale } from "@/lib/supabase/rpc";
import { trackEvent } from "@/lib/analytics/ga4";
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

export function useSaleEdit(): UseMutationResult<EditResult, Error, EditSaleInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: edit,
    onSuccess: () => {
      trackEvent("sale_edited", {});
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

export function useSaleDelete(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}
