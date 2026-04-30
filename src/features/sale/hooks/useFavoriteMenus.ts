"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * 지난 7일 동안 가장 많이 팔린 메뉴 ID 순서 (FR-009).
 * 판매 입력 폼이 이 순서로 메뉴를 정렬해 페르소나의 1분 입력 흐름을 단축.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface FavoriteRow {
  menu_id: string;
  quantity: number;
}

async function fetchFavorites(): Promise<string[]> {
  const supabase = createClient();
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString().slice(0, 10);

  // sales!inner(sold_at)는 join 필터용 — projection에는 menu_id / quantity만 가져옴.
  const { data, error } = await supabase
    .from("sale_items")
    .select("menu_id, quantity, sales!inner(sold_at)")
    .gte("sales.sold_at", sevenDaysAgo);

  if (error) throw new Error(error.message);

  const totals = new Map<string, number>();
  for (const row of (data ?? []) as ReadonlyArray<FavoriteRow>) {
    totals.set(row.menu_id, (totals.get(row.menu_id) ?? 0) + row.quantity);
  }

  return Array.from(totals.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);
}

export function useFavoriteMenus(): UseQueryResult<string[]> {
  return useQuery({
    queryKey: ["sales", "favorites", "7d"],
    queryFn: fetchFavorites,
    staleTime: 5 * 60 * 1000,
  });
}
