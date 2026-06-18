"use client";

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { depletionForecastQueryKey } from "@/features/inventory/hooks/useDepletionForecast";
import { todayDashboardQueryKey } from "@/features/dashboard/hooks/useTodayDashboard";
import type { Weekday } from "@/lib/domain/regular-days-off";
import { updateRegularDaysOff } from "@/lib/supabase/rpc";
import type { Database } from "@/lib/supabase/types";

interface UpdateStoreNameInput {
  userId: string;
  storeName: string;
}

interface UpdateRegularDaysOffInput {
  daysOff: readonly Weekday[];
}

interface UpdateSafetyBufferDaysInput {
  userId: string;
  safetyBufferDays: number;
}

interface UpdatePurchaseCoverageDaysInput {
  userId: string;
  purchaseCoverageDays: number;
}

export async function invalidateSettingsRelatedQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: todayDashboardQueryKey }),
    queryClient.invalidateQueries({ queryKey: depletionForecastQueryKey }),
    queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  ]);
}

async function updateStoreName(input: UpdateStoreNameInput): Promise<string> {
  const supabase = createClient() as unknown as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from("users")
    .update({ store_name: input.storeName })
    .eq("id", input.userId)
    .select("store_name")
    .single();

  if (error) throw new Error(error.message);
  if (!data?.store_name) throw new Error("가게 이름 저장 결과가 비어 있습니다.");
  return data.store_name;
}

async function persistRegularDaysOff(
  input: UpdateRegularDaysOffInput,
): Promise<readonly Weekday[]> {
  const supabase = createClient();
  const { data, error } = await updateRegularDaysOff(supabase, {
    p_days_off: input.daysOff,
  });

  if (error) throw new Error(error.message);
  return data?.[0]?.days_off ?? input.daysOff;
}

async function updateSafetyBufferDays(input: UpdateSafetyBufferDaysInput): Promise<number> {
  const supabase = createClient() as unknown as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from("users")
    .update({ safety_buffer_days: input.safetyBufferDays })
    .eq("id", input.userId)
    .select("safety_buffer_days")
    .single();

  if (error) throw new Error(error.message);
  if (typeof data?.safety_buffer_days !== "number") {
    throw new Error("안전여유일 저장 결과가 비어 있습니다.");
  }
  return data.safety_buffer_days;
}

async function updatePurchaseCoverageDays(input: UpdatePurchaseCoverageDaysInput): Promise<number> {
  const supabase = createClient() as unknown as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from("users")
    .update({ purchase_coverage_days: input.purchaseCoverageDays })
    .eq("id", input.userId)
    .select("purchase_coverage_days")
    .single();

  if (error) throw new Error(error.message);
  if (typeof data?.purchase_coverage_days !== "number") {
    throw new Error("발주 커버일 저장 결과가 비어 있습니다.");
  }
  return data.purchase_coverage_days;
}

export function useUpdateStoreName(): UseMutationResult<string, Error, UpdateStoreNameInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateStoreName,
    onSuccess: async () => {
      await invalidateSettingsRelatedQueries(queryClient);
    },
  });
}

export function useUpdateRegularDaysOff(): UseMutationResult<
  readonly Weekday[],
  Error,
  UpdateRegularDaysOffInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: persistRegularDaysOff,
    onSuccess: async () => {
      await invalidateSettingsRelatedQueries(queryClient);
    },
  });
}

export function useUpdateSafetyBufferDays(): UseMutationResult<
  number,
  Error,
  UpdateSafetyBufferDaysInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSafetyBufferDays,
    onSuccess: async () => {
      await invalidateSettingsRelatedQueries(queryClient);
    },
  });
}

export function useUpdatePurchaseCoverageDays(): UseMutationResult<
  number,
  Error,
  UpdatePurchaseCoverageDaysInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePurchaseCoverageDays,
    onSuccess: async () => {
      await invalidateSettingsRelatedQueries(queryClient);
    },
  });
}
