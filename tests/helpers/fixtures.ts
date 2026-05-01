import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { cloneMenuTemplate } from "@/lib/supabase/rpc";
import { getServiceRoleClient, type TestUser } from "./test-supabase";

interface SeedCafeWithBeanOptions {
  /** 원두 current_stock 값 — undefined 시 update 건너뜀 (clone 직후 0) */
  stock?: number;
  /** 원두 current_avg_price 값 — stock과 함께 update */
  avgPrice?: number;
  menuName?: string;
  ingredientName?: string;
}

/**
 * cafe 템플릿 clone + 원두 단가/재고 시드 — sale_save / sale_edit / dashboard /
 * calendar_month / purchase 등 5개 통합 테스트가 같은 30줄 setup을 반복하던 패턴.
 *
 * stock/avgPrice가 둘 다 있으면 admin client로 update (RLS 우회). 둘 중 하나만
 * 주는 것은 의미 없어 둘 다 필수처럼 다룸 (둘 다 없으면 update 자체 skip).
 */
export async function seedCafeWithBean(
  client: SupabaseClient<Database>,
  user: TestUser,
  options: SeedCafeWithBeanOptions = {},
): Promise<{ menuId: string; ingredientId: string }> {
  const menuName = options.menuName ?? "아메리카노";
  const ingredientName = options.ingredientName ?? "원두";

  const cloneResult = await cloneMenuTemplate(client, { storeType: "cafe" });
  if (cloneResult.error) {
    throw new Error(`cloneMenuTemplate failed: ${cloneResult.error.message}`);
  }

  const menu = await client.from("menus").select("id").eq("name", menuName).single();
  if (menu.error || !menu.data) {
    throw new Error(`menu '${menuName}' lookup failed: ${menu.error?.message ?? "no row"}`);
  }

  const admin = getServiceRoleClient();
  const ing = await admin
    .from("ingredients")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", ingredientName)
    .single();
  if (ing.error || !ing.data) {
    throw new Error(
      `ingredient '${ingredientName}' lookup failed: ${ing.error?.message ?? "no row"}`,
    );
  }

  if (options.stock !== undefined && options.avgPrice !== undefined) {
    const update = await admin
      .from("ingredients")
      .update({ current_stock: options.stock, current_avg_price: options.avgPrice })
      .eq("id", ing.data.id);
    if (update.error) {
      throw new Error(`ingredient stock update failed: ${update.error.message}`);
    }
  }

  return { menuId: menu.data.id, ingredientId: ing.data.id };
}

interface InsertResultLike<T> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * `admin.from(...).insert(...).select(...).single()` 결과의 error/null 가드를 일괄.
 * rls.test.ts beforeAll의 8개 insert가 모두 동일한 8줄 패턴이라 단일 함수로 축약.
 */
export async function mustInsert<T>(
  promise: PromiseLike<InsertResultLike<T>>,
  label: string,
): Promise<T> {
  const result = await promise;
  if (result.error || !result.data) {
    throw new Error(`${label} fixture failed: ${result.error?.message ?? "no row"}`);
  }
  return result.data;
}
