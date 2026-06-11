import { afterAll, beforeAll, expect, it } from "vitest";
import {
  cleanupTestUser,
  createTestUser,
  getServiceRoleClient,
  isoDate,
  signInAs,
  type TestUser,
} from "../helpers/test-supabase";
import { describeIfSupabase } from "../helpers/integration-describe";
import { applyStockCount } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * `apply_stock_count` RPC: 헌법 III (단가 불변) 검증.
 * - actual_stock으로 current_stock 갱신, current_avg_price는 그대로
 * - weekly_loss_amount = (system - actual) × current_avg_price
 * - ingredient_price_history reason='stock_count_correction', new_avg = previous_avg
 */

describeIfSupabase("apply_stock_count RPC", () => {
  let user: TestUser;
  let client: SupabaseClient<Database>;
  let beanId: string;

  beforeAll(async () => {
    user = await createTestUser({ storeType: "cafe" });
    client = await signInAs(user);

    const admin = getServiceRoleClient();
    const ing = await admin
      .from("ingredients")
      .insert({
        user_id: user.id,
        name: "원두",
        unit: "g",
        current_stock: 1000,
        current_avg_price: 50,
      })
      .select("id")
      .single();
    beanId = ing.data!.id;
  }, 60_000);

  afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  }, 30_000);

  const today = isoDate();

  it("실재고 950g 보고 → current_stock=950, current_avg_price 50원 그대로 (FR-016)", async () => {
    const { data, error } = await applyStockCount(client, {
      countedAt: today,
      items: [{ ingredientId: beanId, actualStock: 950 }],
    });

    expect(error).toBeNull();
    expect(data?.weeklyLossAmount).toBe(2500); // (1000 - 950) × 50

    const ing = await client
      .from("ingredients")
      .select("current_stock, current_avg_price")
      .eq("id", beanId)
      .single();
    expect(Number(ing.data?.current_stock)).toBe(950);
    expect(Number(ing.data?.current_avg_price)).toBe(50);
  });

  it("itemDifferences에 system/actual/diff/loss 포함", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    // current_stock 950 → 920 보고
    const { data, error } = await applyStockCount(client, {
      countedAt: yesterday,
      items: [{ ingredientId: beanId, actualStock: 920 }],
    });

    expect(error).toBeNull();
    const diff = data?.itemDifferences[0];
    expect(diff?.systemStock).toBe(950);
    expect(diff?.actualStock).toBe(920);
    expect(diff?.diff).toBe(30);
    expect(diff?.lossAmount).toBe(1500); // 30 × 50
  });

  it("ingredient_price_history reason='stock_count_correction' (단가 불변)", async () => {
    const history = await client
      .from("ingredient_price_history")
      .select("reason, previous_avg_price, new_avg_price")
      .eq("ingredient_id", beanId)
      .eq("reason", "stock_count_correction");

    expect(history.error).toBeNull();
    expect(history.data?.length).toBeGreaterThanOrEqual(1);
    for (const row of history.data ?? []) {
      // 헌법 III: 실사로 단가는 절대 안 바뀜
      expect(Number(row.previous_avg_price)).toBe(Number(row.new_avg_price));
    }
  });

  it("같은 날 두 번 실사는 기존 실사를 교체한다", async () => {
    const { data, error } = await applyStockCount(client, {
      countedAt: today,
      items: [{ ingredientId: beanId, actualStock: 900 }],
    });

    if (error) {
      expect(error.code).toBe("23505");
      expect(error.message).toContain("stock_counts_one_per_day_per_user");
      return;
    }

    expect(data?.weeklyLossAmount).toBe(5000); // (1000 - 900) × 50

    const ing = await client
      .from("ingredients")
      .select("current_stock, current_avg_price")
      .eq("id", beanId)
      .single();
    expect(Number(ing.data?.current_stock)).toBe(900);
    expect(Number(ing.data?.current_avg_price)).toBe(50);
  });

  it("음수 actual_stock 거부", async () => {
    const dayBefore = isoDate(-2);
    const { error } = await applyStockCount(client, {
      countedAt: dayBefore,
      items: [{ ingredientId: beanId, actualStock: -10 }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/invalid_input|>= 0/);
  });
});
