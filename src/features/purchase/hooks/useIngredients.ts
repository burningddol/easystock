"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { saveIngredient } from "@/lib/supabase/rpc";
import type { IngredientInput } from "../schemas";

export interface IngredientRow {
  id: string;
  name: string;
  unit: "g" | "ml" | "piece";
  current_avg_price: number;
}

interface RawIngredientRow {
  id: string;
  name: string;
  unit: "g" | "ml" | "piece";
  current_avg_price: number;
}

export const ingredientListQueryKey = ["ingredients", "list"] as const;

async function fetchIngredients(): Promise<IngredientRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, unit, current_avg_price")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawIngredientRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    current_avg_price: Number(row.current_avg_price),
  }));
}

export function useIngredients(): UseQueryResult<IngredientRow[]> {
  return useQuery({ queryKey: ingredientListQueryKey, queryFn: fetchIngredients });
}

async function createIngredient(input: IngredientInput): Promise<IngredientRow> {
  const supabase = createClient();
  const { data, error } = await saveIngredient(supabase, {
    name: input.name,
    unit: input.unit,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("save_ingredient: empty response");
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    current_avg_price: Number(row.current_avg_price),
  };
}

export function useCreateIngredient(): UseMutationResult<IngredientRow, Error, IngredientInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createIngredient,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ingredientListQueryKey });
    },
  });
}
