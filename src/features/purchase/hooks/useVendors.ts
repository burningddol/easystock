"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { loadVendors, type LookupClient, type VendorRow } from "@/lib/application/lookups";
import { invalidateVendorWriteRelatedQueries } from "@/lib/query-invalidation";
import { saveVendor } from "@/lib/supabase/rpc";
import type { Database } from "@/lib/supabase/types";
import type { VendorInput } from "../schemas";

export type { VendorRow } from "@/lib/application/lookups";

export const vendorListQueryKey = ["vendors", "list"] as const;

async function fetchVendors(): Promise<VendorRow[]> {
  const supabase = createClient() as unknown as LookupClient;
  return loadVendors(supabase);
}

export function useVendors(): UseQueryResult<VendorRow[]> {
  return useQuery({ queryKey: vendorListQueryKey, queryFn: fetchVendors });
}

async function createVendor(input: VendorInput): Promise<VendorRow> {
  const supabase = createClient();
  const { data, error } = await saveVendor(supabase, {
    name: input.name,
    leadTimeDays: input.leadTimeDays,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("save_vendor: empty response");
  return row;
}

interface UpdateVendorLeadTimeInput {
  vendorId: string;
  leadTimeDays: number;
}

async function updateVendorLeadTime(input: UpdateVendorLeadTimeInput): Promise<VendorRow> {
  const supabase = createClient() as unknown as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from("vendors")
    .update({
      lead_time_days: input.leadTimeDays,
    } satisfies Database["public"]["Tables"]["vendors"]["Update"])
    .eq("id", input.vendorId)
    .select("id, name, lead_time_days")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("거래처 저장 결과가 비어 있습니다.");

  return {
    id: data.id,
    name: data.name,
    lead_time_days: Number(data.lead_time_days),
  };
}

export function useCreateVendor(): UseMutationResult<VendorRow, Error, VendorInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVendor,
    onSuccess: () => {
      invalidateVendorWriteRelatedQueries(queryClient);
    },
  });
}

export function useUpdateVendorLeadTime(): UseMutationResult<
  VendorRow,
  Error,
  UpdateVendorLeadTimeInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateVendorLeadTime,
    onSuccess: () => {
      invalidateVendorWriteRelatedQueries(queryClient);
    },
  });
}
