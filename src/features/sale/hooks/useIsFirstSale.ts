"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * 사용자가 아직 판매를 한 번도 입력하지 않았는지 확인.
 * GA4 `first_sale_input` 이벤트 발화 조건.
 *
 * 주의: 같은 페이지를 두 탭에서 열고 동시에 저장하면 false-positive 가능
 * (양쪽 다 isFirstSale=true로 fetch). MVP에선 허용.
 */
export function useIsFirstSale(): UseQueryResult<boolean> {
  return useQuery({
    queryKey: ["sales", "is-first"],
    queryFn: async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return (count ?? 0) === 0;
    },
    staleTime: 60_000,
  });
}
