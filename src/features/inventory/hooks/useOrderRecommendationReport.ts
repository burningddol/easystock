"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  getOrderRecommendationReport,
  type OrderRecommendationReportData,
} from "@/lib/supabase/rpc";

export const orderRecommendationReportQueryKey = ["inventory", "order-report"] as const;

async function fetchOrderRecommendationReport(): Promise<OrderRecommendationReportData> {
  const supabase = createClient();
  const { data, error } = await getOrderRecommendationReport(supabase, 30);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("발주 추천 리포트 데이터가 비어 있습니다.");
  return data;
}

export function useOrderRecommendationReport(): UseQueryResult<OrderRecommendationReportData> {
  return useQuery({
    queryKey: orderRecommendationReportQueryKey,
    queryFn: fetchOrderRecommendationReport,
    staleTime: 60 * 1000,
  });
}
