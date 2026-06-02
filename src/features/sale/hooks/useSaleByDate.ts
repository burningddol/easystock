"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { loadSaleByDate, type SaleWithItems } from "@/lib/application/lookups";

/**
 * 특정 날짜의 사용자 sale + items + 메뉴 join.
 * 편집 흐름에서 기존 데이터 prefill + 7일 lock 판단(created_at)에 사용.
 */

export type { SaleWithItems } from "@/lib/application/lookups";

async function fetchSaleByDate(date: string): Promise<SaleWithItems | null> {
  const supabase = createClient();
  return loadSaleByDate(supabase, date);
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
