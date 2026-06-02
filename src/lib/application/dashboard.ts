import type { TodayDashboardData } from "@/lib/supabase/rpc";
import { getTodayDashboard } from "@/lib/supabase/rpc";

interface RpcClient {
  rpc: unknown;
}

export async function loadTodayDashboard(client: RpcClient): Promise<TodayDashboardData> {
  const { data, error } = await getTodayDashboard(client);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("dashboard data missing");
  return data;
}
