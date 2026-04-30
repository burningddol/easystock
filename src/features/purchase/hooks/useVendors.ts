"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { saveVendor } from "@/lib/supabase/rpc";
import type { VendorInput } from "../schemas";

export interface VendorRow {
  id: string;
  name: string;
  lead_time_days: number;
}

export const vendorListQueryKey = ["vendors", "list"] as const;

async function fetchVendors(): Promise<VendorRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("id, name, lead_time_days")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
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
  return { id: row.id, name: row.name, lead_time_days: row.lead_time_days };
}

export function useCreateVendor(): UseMutationResult<VendorRow, Error, VendorInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVendor,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vendorListQueryKey });
    },
  });
}
