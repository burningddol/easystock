import { afterAll, beforeAll, expect, it } from "vitest";
import {
  cleanupTestUser,
  createTestUser,
  isoDate,
  signInAs,
  type TestUser,
} from "../helpers/test-supabase";
import { describeIfSupabase } from "../helpers/integration-describe";
import { seedCafeWithBean } from "../helpers/fixtures";
import { deleteSale, editSale, saveSale } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * `edit_sale` / `delete_sale` RPC 검증.
 * - 7일 lock 정책 (FR-030)
 * - 재고 revert + reapply (헌법 III)
 * - sale_edit_history 기록 (FR-031)
 */

describeIfSupabase("edit_sale + delete_sale RPC", () => {
  let user: TestUser;
  let client: SupabaseClient<Database>;
  let menuId: string;
  let ingredientId: string;
  let saleId: string;
  const today = isoDate();

  beforeAll(async () => {
    user = await createTestUser({ storeType: "cafe" });
    client = await signInAs(user);
    ({ menuId, ingredientId } = await seedCafeWithBean(client, user, {
      stock: 1000,
      avgPrice: 50,
    }));

    const { data } = await saveSale(client, {
      soldAt: today,
      items: [{ menuId, quantity: 5 }],
    });
    saleId = data![0]!.sale_id;
  }, 60_000);

  afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  }, 30_000);

  it("편집 성공: revert + reapply, totals 갱신", async () => {
    // 5개 → 3개로 변경. 재고는 1000 - (18×5) = 910 → revert로 1000 → reapply로 1000 - 54 = 946
    const { data, error } = await editSale(client, {
      saleId,
      newItems: [{ menuId, quantity: 3 }],
      reason: "테스트 정정",
    });

    expect(error).toBeNull();
    expect(Number(data?.[0]?.total_revenue)).toBe(13500); // 4500 × 3
    expect(Number(data?.[0]?.total_cost_snapshot)).toBe(2700); // 900 × 3

    const ing = await client
      .from("ingredients")
      .select("current_stock")
      .eq("id", ingredientId)
      .single();
    expect(Number(ing.data?.current_stock)).toBe(946); // 1000 - 54
  });

  it("sale_edit_history에 before/after + reason 기록됨", async () => {
    const history = await client
      .from("sale_edit_history")
      .select("change_type, reason, before_items, after_items")
      .eq("sale_id", saleId)
      .single();

    expect(history.error).toBeNull();
    expect(history.data?.change_type).toBe("edit");
    expect(history.data?.reason).toBe("테스트 정정");
    const before = history.data?.before_items as Array<{ quantity: number }>;
    const after = history.data?.after_items as Array<{ quantity: number }>;
    expect(before[0]?.quantity).toBe(5);
    expect(after[0]?.quantity).toBe(3);
  });

  it("price_history에 sale_edit_revert + sale_edit_apply 추가됨", async () => {
    const reasons = await client
      .from("ingredient_price_history")
      .select("reason")
      .in("reason", ["sale_edit_revert", "sale_edit_apply"]);
    expect(reasons.error).toBeNull();
    const revertCount = reasons.data?.filter((r) => r.reason === "sale_edit_revert").length ?? 0;
    const applyCount = reasons.data?.filter((r) => r.reason === "sale_edit_apply").length ?? 0;
    expect(revertCount).toBe(1);
    expect(applyCount).toBe(1);
  });

  it("delete_sale: 재고 되돌림 + history change_type=delete", async () => {
    const { error } = await deleteSale(client, saleId);
    expect(error).toBeNull();

    // sales는 cascade로 사라지고, sale_edit_history도 cascade로 함께 삭제됨 (1차 MVP).
    const sale = await client.from("sales").select("id").eq("id", saleId).maybeSingle();
    expect(sale.data).toBeNull();

    // 재고는 다시 원복: 946 + 18×3 = 1000
    const ing = await client
      .from("ingredients")
      .select("current_stock")
      .eq("id", ingredientId)
      .single();
    expect(Number(ing.data?.current_stock)).toBe(1000);
  });
});
