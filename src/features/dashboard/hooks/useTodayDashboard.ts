"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getTodayDashboard, type TodayDashboardData } from "@/lib/supabase/rpc";

export const todayDashboardQueryKey = ["dashboard", "today"] as const;

async function fetchTodayDashboard(): Promise<TodayDashboardData> {
  const supabase = createClient();
  const { data, error } = await getTodayDashboard(supabase);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("dashboard data missing");
  return data;
}

export function useTodayDashboard(): UseQueryResult<TodayDashboardData> {
  return useQuery({
    queryKey: todayDashboardQueryKey,
    queryFn: fetchTodayDashboard,
    staleTime: 60 * 1000,
  });
}
