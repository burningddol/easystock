"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deleteIngredient, saveIngredient } from "@/lib/supabase/rpc";
import { depletionForecastQueryKey } from "@/features/inventory/hooks/useDepletionForecast";
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

function invalidateIngredientCaches(queryClient: ReturnType<typeof useQueryClient>): void {
  // 재료 목록 + 소진 예측 둘 다 무효화 — 두 쿼리는 모두 ingredients 테이블에 의존.
  void queryClient.invalidateQueries({ queryKey: ingredientListQueryKey });
  void queryClient.invalidateQueries({ queryKey: depletionForecastQueryKey });
}

export function useCreateIngredient(): UseMutationResult<IngredientRow, Error, IngredientInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createIngredient,
    onSuccess: () => invalidateIngredientCaches(queryClient),
  });
}

export interface DeleteIngredientResult {
  ingredientId: string;
  inUseMenuCount: number;
}

async function deleteIngredientById(ingredientId: string): Promise<DeleteIngredientResult> {
  const supabase = createClient();
  const { data, error } = await deleteIngredient(supabase, ingredientId);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("delete_ingredient: empty response");
  return { ingredientId: row.ingredient_id, inUseMenuCount: row.in_use_menu_count };
}

export function useDeleteIngredient(): UseMutationResult<DeleteIngredientResult, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteIngredientById,
    onSuccess: () => invalidateIngredientCaches(queryClient),
  });
}
