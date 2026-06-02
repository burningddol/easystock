"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { loadTodayDashboard } from "@/lib/application/dashboard";
import type { TodayDashboardData } from "@/lib/supabase/rpc";

export const todayDashboardQueryKey = ["dashboard", "today"] as const;

async function fetchTodayDashboard(): Promise<TodayDashboardData> {
  const supabase = createClient();
  return loadTodayDashboard(supabase);
}

export function useTodayDashboard(): UseQueryResult<TodayDashboardData> {
  return useQuery({
    queryKey: todayDashboardQueryKey,
    queryFn: fetchTodayDashboard,
    staleTime: 60 * 1000,
  });
}
