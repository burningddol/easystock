import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUser,
  createTestUser,
  getServiceRoleClient,
  isoDate,
  signInAs,
  type TestUser,
} from "../helpers/test-supabase";
import { describeIfSupabase } from "../helpers/integration-describe";
import { mustInsert } from "../helpers/fixtures";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * 헌법 IV (NON-NEGOTIABLE): user_id 격리 RLS 가드.
 *
 * 검증 대상: users / ingredients / ingredient_price_history
 * 시나리오: A로 로그인 → B가 만든 row를 SELECT/UPDATE/DELETE 시도 → 빈 결과 또는 거부
 *           A가 user_id=B로 INSERT 시도 → RLS WITH CHECK 거부
 *
 * Supabase 환경 변수가 없으면 skip (CI에서는 secret이 설정된 환경에서만 실행).
 */

describeIfSupabase("RLS user_id isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let clientA: SupabaseClient<Database>;
  let ingredientByB: { id: string; user_id: string };
  let menuByB: { id: string };
  let recipeItemByB: { id: string };
  let saleByB: { id: string };
  let vendorByB: { id: string };
  let purchaseOrderByB: { id: string };
  let stockCountByB: { id: string };
  let pushSubByB: { id: string };

  beforeAll(async () => {
    userA = await createTestUser({ storeName: "A 가게" });
    userB = await createTestUser({ storeName: "B 가게" });
    clientA = await signInAs(userA);

    const admin = getServiceRoleClient();

    ingredientByB = await mustInsert(
      admin
        .from("ingredients")
        .insert({ user_id: userB.id, name: "B 우유", unit: "ml" })
        .select("id, user_id")
        .single(),
      "ingredient",
    );

    menuByB = await mustInsert(
      admin
        .from("menus")
        .insert({ user_id: userB.id, name: "B 라떼", price: 5000 })
        .select("id")
        .single(),
      "menu",
    );

    recipeItemByB = await mustInsert(
      admin
        .from("recipe_items")
        .insert({
          menu_id: menuByB.id,
          user_id: userB.id,
          ingredient_id: ingredientByB.id,
          quantity_per_serving: 100,
        })
        .select("id")
        .single(),
      "recipe",
    );

    saleByB = await mustInsert(
      admin
        .from("sales")
        .insert({
          user_id: userB.id,
          sold_at: isoDate(),
          total_revenue: 5000,
          total_cost_snapshot: 1000,
        })
        .select("id")
        .single(),
      "sale",
    );

    vendorByB = await mustInsert(
      admin
        .from("vendors")
        .insert({ user_id: userB.id, name: "B 도매상", lead_time_days: 1 })
        .select("id")
        .single(),
      "vendor",
    );

    purchaseOrderByB = await mustInsert(
      admin
        .from("purchase_orders")
        .insert({
          user_id: userB.id,
          vendor_id: vendorByB.id,
          purchased_at: isoDate(),
          total_amount: 50000,
        })
        .select("id")
        .single(),
      "purchase_order",
    );

    stockCountByB = await mustInsert(
      admin
        .from("daily_stock_counts")
        .insert({ user_id: userB.id, counted_at: isoDate() })
        .select("id")
        .single(),
      "stock_count",
    );

    pushSubByB = await mustInsert(
      admin
        .from("push_subscriptions")
        .insert({
          user_id: userB.id,
          endpoint: `https://push.example.test/${userB.id}`,
          keys_p256dh: "fake-p256dh",
          keys_auth: "fake-auth",
        })
        .select("id")
        .single(),
      "push_sub",
    );
  }, 30_000);

  afterAll(async () => {
    if (userA?.id) await cleanupTestUser(userA.id);
    if (userB?.id) await cleanupTestUser(userB.id);
  }, 30_000);

  describe("users table", () => {
    it("A는 B의 users row를 조회할 수 없다", async () => {
      const { data, error } = await clientA.from("users").select("id").eq("id", userB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("A는 본인 users row만 조회 가능", async () => {
      const { data, error } = await clientA.from("users").select("id").eq("id", userA.id);
      expect(error).toBeNull();
      expect(data?.[0]?.id).toBe(userA.id);
    });

    it("A는 B의 users row를 UPDATE할 수 없다", async () => {
      const { data } = await clientA
        .from("users")
        .update({ store_name: "해킹시도" })
        .eq("id", userB.id)
        .select("id");
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("ingredients table", () => {
    it("A는 B의 ingredient를 조회할 수 없다", async () => {
      const { data, error } = await clientA
        .from("ingredients")
        .select("id")
        .eq("id", ingredientByB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("A는 user_id=B로 ingredient INSERT를 거부당한다", async () => {
      const { data, error } = await clientA
        .from("ingredients")
        .insert({ user_id: userB.id, name: "위장 재료", unit: "g" })
        .select("id");
      expect(data ?? []).toHaveLength(0);
      expect(error).not.toBeNull();
    });

    it("A는 B의 ingredient UPDATE/DELETE 시 영향 행 0", async () => {
      const upd = await clientA
        .from("ingredients")
        .update({ name: "탈취" })
        .eq("id", ingredientByB.id)
        .select("id");
      expect(upd.data ?? []).toHaveLength(0);

      const del = await clientA
        .from("ingredients")
        .delete()
        .eq("id", ingredientByB.id)
        .select("id");
      expect(del.data ?? []).toHaveLength(0);
    });
  });

  describe("ingredient_price_history table", () => {
    it("A는 B의 price_history를 조회할 수 없다", async () => {
      const { data, error } = await clientA
        .from("ingredient_price_history")
        .select("id")
        .eq("user_id", userB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("menus table", () => {
    it("A는 B의 menu를 조회할 수 없다", async () => {
      const { data, error } = await clientA.from("menus").select("id").eq("id", menuByB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("A는 user_id=B로 menu INSERT를 거부당한다", async () => {
      const { data, error } = await clientA
        .from("menus")
        .insert({ user_id: userB.id, name: "위장 메뉴", price: 1000 })
        .select("id");
      expect(data ?? []).toHaveLength(0);
      expect(error).not.toBeNull();
    });

    it("A는 B의 menu UPDATE/DELETE 시 영향 행 0", async () => {
      const upd = await clientA
        .from("menus")
        .update({ name: "탈취 메뉴" })
        .eq("id", menuByB.id)
        .select("id");
      expect(upd.data ?? []).toHaveLength(0);

      const del = await clientA.from("menus").delete().eq("id", menuByB.id).select("id");
      expect(del.data ?? []).toHaveLength(0);
    });
  });

  describe("recipe_items table", () => {
    it("A는 B의 recipe_item을 조회할 수 없다", async () => {
      const { data, error } = await clientA
        .from("recipe_items")
        .select("id")
        .eq("id", recipeItemByB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("A는 user_id=B로 recipe_item INSERT를 거부당한다", async () => {
      const { data, error } = await clientA
        .from("recipe_items")
        .insert({
          menu_id: menuByB.id,
          user_id: userB.id,
          ingredient_id: ingredientByB.id,
          quantity_per_serving: 50,
        })
        .select("id");
      expect(data ?? []).toHaveLength(0);
      expect(error).not.toBeNull();
    });
  });

  describe("sales / sale_items / sale_edit_history tables", () => {
    it("A는 B의 sale을 조회할 수 없다", async () => {
      const { data, error } = await clientA.from("sales").select("id").eq("id", saleByB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("A는 B의 sale을 UPDATE/DELETE 시 영향 행 0", async () => {
      const upd = await clientA
        .from("sales")
        .update({ total_revenue: 99999 })
        .eq("id", saleByB.id)
        .select("id");
      expect(upd.data ?? []).toHaveLength(0);

      const del = await clientA.from("sales").delete().eq("id", saleByB.id).select("id");
      expect(del.data ?? []).toHaveLength(0);
    });

    it("A는 B의 sale_items를 조회할 수 없다", async () => {
      const { data, error } = await clientA
        .from("sale_items")
        .select("id")
        .eq("sale_id", saleByB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("A는 B의 sale_edit_history를 조회할 수 없다", async () => {
      const { data, error } = await clientA
        .from("sale_edit_history")
        .select("id")
        .eq("sale_id", saleByB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("vendors / purchase_orders / purchase_order_items tables", () => {
    it("A는 B의 vendor를 조회할 수 없다", async () => {
      const { data, error } = await clientA.from("vendors").select("id").eq("id", vendorByB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("A는 user_id=B로 vendor INSERT를 거부당한다", async () => {
      const { data, error } = await clientA
        .from("vendors")
        .insert({ user_id: userB.id, name: "위장 거래처", lead_time_days: 1 })
        .select("id");
      expect(data ?? []).toHaveLength(0);
      expect(error).not.toBeNull();
    });

    it("A는 B의 purchase_order를 조회할 수 없다", async () => {
      const { data, error } = await clientA
        .from("purchase_orders")
        .select("id")
        .eq("id", purchaseOrderByB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("daily_stock_counts / stock_count_items tables", () => {
    it("A는 B의 stock_count를 조회할 수 없다", async () => {
      const { data, error } = await clientA
        .from("daily_stock_counts")
        .select("id")
        .eq("id", stockCountByB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("A는 user_id=B로 stock_count INSERT를 거부당한다", async () => {
      const { data, error } = await clientA
        .from("daily_stock_counts")
        .insert({ user_id: userB.id, counted_at: "2026-04-01" })
        .select("id");
      expect(data ?? []).toHaveLength(0);
      expect(error).not.toBeNull();
    });
  });

  describe("push_subscriptions table", () => {
    it("A는 B의 push_subscription을 조회할 수 없다", async () => {
      const { data, error } = await clientA
        .from("push_subscriptions")
        .select("id")
        .eq("id", pushSubByB.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("A는 user_id=B로 push_subscription INSERT를 거부당한다", async () => {
      const { data, error } = await clientA
        .from("push_subscriptions")
        .insert({
          user_id: userB.id,
          endpoint: "https://push.example.test/attack",
          keys_p256dh: "x",
          keys_auth: "y",
        })
        .select("id");
      expect(data ?? []).toHaveLength(0);
      expect(error).not.toBeNull();
    });
  });
});
