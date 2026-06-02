"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { loadVendors, type VendorRow } from "@/lib/application/lookups";
import { saveVendor } from "@/lib/supabase/rpc";
import type { VendorInput } from "../schemas";

export type { VendorRow } from "@/lib/application/lookups";

export const vendorListQueryKey = ["vendors", "list"] as const;

async function fetchVendors(): Promise<VendorRow[]> {
  const supabase = createClient();
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

export function useCreateVendor(): UseMutationResult<VendorRow, Error, VendorInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVendor,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vendorListQueryKey });
    },
  });
}
