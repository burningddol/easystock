"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * 사용자가 매입을 한 번도 등록 안 했는지 확인 — first_purchase_logged GA4 발화 조건.
 * useIsFirstSale과 동일 패턴. 다중 탭 staleness는 MVP 허용.
 */
export function useIsFirstPurchase(): UseQueryResult<boolean> {
  return useQuery({
    queryKey: ["purchases", "is-first"],
    queryFn: async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return (count ?? 0) === 0;
    },
    staleTime: 60_000,
  });
}
