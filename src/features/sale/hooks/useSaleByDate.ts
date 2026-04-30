"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * 특정 날짜의 사용자 sale + items + 메뉴 join.
 * 편집 흐름에서 기존 데이터 prefill + 7일 lock 판단(created_at)에 사용.
 */

export interface SaleWithItems {
  id: string;
  sold_at: string;
  created_at: string;
  total_revenue: number;
  total_cost_snapshot: number;
  items: Array<{
    id: string;
    menu_id: string;
    quantity: number;
    unit_price: number;
    menu_cost_snapshot: number;
  }>;
}

interface RawRow {
  id: string;
  sold_at: string;
  created_at: string;
  total_revenue: number;
  total_cost_snapshot: number;
  sale_items: Array<{
    id: string;
    menu_id: string;
    quantity: number;
    unit_price: number;
    menu_cost_snapshot: number;
  }>;
}

async function fetchSaleByDate(date: string): Promise<SaleWithItems | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales")
    .select(
      `
      id, sold_at, created_at, total_revenue, total_cost_snapshot,
      sale_items (id, menu_id, quantity, unit_price, menu_cost_snapshot)
    `,
    )
    .eq("sold_at", date)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as RawRow;
  return {
    id: row.id,
    sold_at: row.sold_at,
    created_at: row.created_at,
    total_revenue: Number(row.total_revenue),
    total_cost_snapshot: Number(row.total_cost_snapshot),
    items: row.sale_items.map((si) => ({
      id: si.id,
      menu_id: si.menu_id,
      quantity: si.quantity,
      unit_price: Number(si.unit_price),
      menu_cost_snapshot: Number(si.menu_cost_snapshot),
    })),
  };
}

export function saleByDateQueryKey(date: string): readonly unknown[] {
  return ["sales", "by-date", date] as const;
}

export function useSaleByDate(date: string): UseQueryResult<SaleWithItems | null> {
  return useQuery({
    queryKey: saleByDateQueryKey(date),
    queryFn: () => fetchSaleByDate(date),
  });
}
