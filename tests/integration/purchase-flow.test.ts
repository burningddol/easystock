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
import { savePurchase } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * `save_purchase` RPC: 헌법 III (가중 이동 평균법) 핵심 검증.
 * - 첫 매입(stock=0) → new_avg = unit_price (FR-004)
 * - 두 번째 매입 → 가중 평균 갱신
 * - ±5% 변동 시 priceChangeAlerts 반환 (FR-005)
 * - ingredient_price_history reason='purchase' 기록 (FR-029)
 * - 메뉴 마진 자동 재계산 (재료 단가 변경 → 메뉴 원가 재계산은 클라이언트 측, 통합 검증 X)
 */

describeIfSupabase("save_purchase RPC + 가중 이동 평균법", () => {
  let user: TestUser;
  let client: SupabaseClient<Database>;
  let vendorId: string;
  let beanId: string;

  beforeAll(async () => {
    user = await createTestUser({ storeType: "cafe" });
    client = await signInAs(user);

    const admin = getServiceRoleClient();

    const vendor = await admin
      .from("vendors")
      .insert({ user_id: user.id, name: "테스트 도매상", lead_time_days: 1 })
      .select("id")
      .single();
    vendorId = vendor.data!.id;

    const ing = await admin
      .from("ingredients")
      .insert({ user_id: user.id, name: "원두", unit: "g" })
      .select("id")
      .single();
    beanId = ing.data!.id;
  }, 60_000);

  afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  }, 30_000);

  const today = isoDate();

  it("첫 매입 (stock=0): new_avg = amount/quantity, alerts 없음", async () => {
    // 1000g @ 50,000원 → unit_price = 50원/g
    const { data, error } = await savePurchase(client, {
      vendorId,
      purchasedAt: today,
      items: [{ ingredientId: beanId, quantity: 1000, amount: 50000 }],
    });

    expect(error).toBeNull();
    expect(data?.priceChangeAlerts).toEqual([]);

    const ing = await client
      .from("ingredients")
      .select("current_stock, current_avg_price")
      .eq("id", beanId)
      .single();
    expect(Number(ing.data?.current_stock)).toBe(1000);
    expect(Number(ing.data?.current_avg_price)).toBe(50);
  });

  it("두 번째 매입 (가중 평균): 1000g@50 + 1000g@70 = 60원/g", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await savePurchase(client, {
      vendorId,
      purchasedAt: yesterday,
      items: [{ ingredientId: beanId, quantity: 1000, amount: 70000 }],
    });

    expect(error).toBeNull();
    // (1000×50 + 1000×70) / 2000 = 60원
    const ing = await client
      .from("ingredients")
      .select("current_stock, current_avg_price")
      .eq("id", beanId)
      .single();
    expect(Number(ing.data?.current_stock)).toBe(2000);
    expect(Number(ing.data?.current_avg_price)).toBe(60);

    // 50 → 60: +20% 변동 → alerts에 1건
    const alerts = data?.priceChangeAlerts ?? [];
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.changePercent).toBe(20);
  });

  it("|change| < 5%이면 alerts에 안 들어감", async () => {
    const dayBefore = isoDate(-2);
    // 2000g @ avg 60 → +100g @ unit_price 62 = (2000×60 + 100×62) / 2100 ≈ 60.0952
    // change = (60.0952 - 60) / 60 × 100 ≈ 0.16%
    const { data, error } = await savePurchase(client, {
      vendorId,
      purchasedAt: dayBefore,
      items: [{ ingredientId: beanId, quantity: 100, amount: 6200 }],
    });

    expect(error).toBeNull();
    expect(data?.priceChangeAlerts).toEqual([]);
  });

  it("ingredient_price_history reason='purchase' 기록", async () => {
    const history = await client
      .from("ingredient_price_history")
      .select("reason, new_avg_price")
      .eq("ingredient_id", beanId)
      .eq("reason", "purchase")
      .order("changed_at", { ascending: true });

    // 위 3개 매입 = 3개 history
    expect(history.error).toBeNull();
    expect(history.data).toHaveLength(3);
    expect(Number(history.data?.[0]?.new_avg_price)).toBe(50);
    expect(Number(history.data?.[1]?.new_avg_price)).toBe(60);
  });

  it("purchase_order_items.unit_price 자동 계산 (generated)", async () => {
    const items = await client
      .from("purchase_order_items")
      .select("quantity, amount, unit_price")
      .eq("ingredient_id", beanId)
      .order("amount", { ascending: false });

    expect(items.error).toBeNull();
    // 70000 / 1000 = 70
    expect(Number(items.data?.[0]?.unit_price)).toBe(70);
    // 50000 / 1000 = 50
    expect(Number(items.data?.[1]?.unit_price)).toBe(50);
    // 6200 / 100 = 62
    expect(Number(items.data?.[2]?.unit_price)).toBe(62);
  });
});
