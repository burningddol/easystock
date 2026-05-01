import { afterAll, beforeAll, expect, it } from "vitest";
import {
  cleanupTestUser,
  createTestUser,
  describeIfSupabase,
  getServiceRoleClient,
  isoDate,
  signInAs,
  type TestUser,
} from "../helpers/test-supabase";
import { cloneMenuTemplate, saveSale } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * `save_sale` RPC: 헌법 III 핵심 흐름 검증.
 * - 트랜잭셔널 저장
 * - 메뉴 원가/판매가 스냅샷 보존
 * - 재료 자동 차감 + ingredient_price_history (sale_consumption)
 * - 같은 날 두 번 저장은 duplicate_sale 거부
 */

describeIfSupabase("save_sale RPC", () => {
  let user: TestUser;
  let client: SupabaseClient<Database>;
  let menuId: string;
  let ingredientId: string;
  const today = isoDate();

  beforeAll(async () => {
    user = await createTestUser({ storeType: "cafe" });
    client = await signInAs(user);

    // cafe 템플릿 → menus + ingredients 생성
    const cloneResult = await cloneMenuTemplate(client, { storeType: "cafe" });
    expect(cloneResult.error).toBeNull();

    // 아메리카노 + 그 재료 1개 가져오기 (가장 단순)
    const menu = await client.from("menus").select("id").eq("name", "아메리카노").single();
    expect(menu.error).toBeNull();
    menuId = menu.data!.id;

    // 재료에 단가 + 재고 부여 (admin client로 RLS 우회)
    const admin = getServiceRoleClient();
    const ing = await admin
      .from("ingredients")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "원두")
      .single();
    ingredientId = ing.data!.id;

    await admin
      .from("ingredients")
      .update({ current_stock: 1000, current_avg_price: 50 })
      .eq("id", ingredientId);
  }, 60_000);

  afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  }, 30_000);

  it("저장 성공: revenue / cost / margin 계산 + sale_items 스냅샷 영구 보존", async () => {
    const { data, error } = await saveSale(client, {
      soldAt: today,
      items: [{ menuId, quantity: 5 }],
    });

    expect(error).toBeNull();
    const row = data?.[0];
    // 아메리카노 4500원 × 5 = 22500
    // 원두 18g × 50원 × 5 = 4500
    // net = 18000, margin = 80%
    expect(Number(row?.total_revenue)).toBe(22500);
    expect(Number(row?.total_cost_snapshot)).toBe(4500);
    expect(Number(row?.total_net_profit)).toBe(18000);
    expect(Number(row?.margin_percent)).toBe(80);

    const items = await client
      .from("sale_items")
      .select("menu_id, quantity, unit_price, menu_cost_snapshot");
    expect(items.data).toHaveLength(1);
    expect(Number(items.data?.[0]?.unit_price)).toBe(4500);
    expect(Number(items.data?.[0]?.menu_cost_snapshot)).toBe(900);
  });

  it("재고 자동 차감: 1000g - 18g × 5 = 910g", async () => {
    const ing = await client
      .from("ingredients")
      .select("current_stock")
      .eq("id", ingredientId)
      .single();
    expect(Number(ing.data?.current_stock)).toBe(910);
  });

  it("ingredient_price_history에 sale_consumption 1건 추가됨 (avg는 불변)", async () => {
    const history = await client
      .from("ingredient_price_history")
      .select("reason, previous_avg_price, new_avg_price, previous_stock, new_stock")
      .eq("reason", "sale_consumption")
      .order("changed_at", { ascending: false })
      .limit(1);
    expect(history.error).toBeNull();
    expect(history.data).toHaveLength(1);
    const row = history.data?.[0];
    expect(Number(row?.previous_avg_price)).toBe(Number(row?.new_avg_price)); // 단가는 sale에서 안 바뀜
    expect(Number(row?.previous_stock) - Number(row?.new_stock)).toBe(90); // 18×5
  });

  it("같은 날 두 번 저장은 duplicate_sale 에러", async () => {
    const { error } = await saveSale(client, {
      soldAt: today,
      items: [{ menuId, quantity: 1 }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/duplicate_sale/);
  });

  it("미래 날짜는 future_date 거부", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const { error } = await saveSale(client, {
      soldAt: futureDate,
      items: [{ menuId, quantity: 1 }],
    });
    expect(error?.message).toMatch(/future_date/);
  });
});
