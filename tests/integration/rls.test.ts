import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUser,
  createTestUser,
  getServiceRoleClient,
  hasSupabaseTestEnv,
  signInAs,
  type TestUser,
} from "../helpers/test-supabase";
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

const describeRls = hasSupabaseTestEnv ? describe : describe.skip;

describeRls("RLS user_id isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let clientA: SupabaseClient<Database>;
  let ingredientByB: { id: string; user_id: string };
  let menuByB: { id: string };
  let recipeItemByB: { id: string };
  let saleByB: { id: string };

  beforeAll(async () => {
    userA = await createTestUser({ storeName: "A 가게" });
    userB = await createTestUser({ storeName: "B 가게" });
    clientA = await signInAs(userA);

    const admin = getServiceRoleClient();

    const ing = await admin
      .from("ingredients")
      .insert({ user_id: userB.id, name: "B 우유", unit: "ml" })
      .select("id, user_id")
      .single();
    if (ing.error || !ing.data) {
      throw new Error(`ingredient fixture failed: ${ing.error?.message ?? "no row"}`);
    }
    ingredientByB = ing.data;

    const menu = await admin
      .from("menus")
      .insert({ user_id: userB.id, name: "B 라떼", price: 5000 })
      .select("id")
      .single();
    if (menu.error || !menu.data) {
      throw new Error(`menu fixture failed: ${menu.error?.message ?? "no row"}`);
    }
    menuByB = menu.data;

    const recipe = await admin
      .from("recipe_items")
      .insert({
        menu_id: menuByB.id,
        user_id: userB.id,
        ingredient_id: ingredientByB.id,
        quantity_per_serving: 100,
      })
      .select("id")
      .single();
    if (recipe.error || !recipe.data) {
      throw new Error(`recipe fixture failed: ${recipe.error?.message ?? "no row"}`);
    }
    recipeItemByB = recipe.data;

    const sale = await admin
      .from("sales")
      .insert({
        user_id: userB.id,
        sold_at: new Date().toISOString().slice(0, 10),
        total_revenue: 5000,
        total_cost_snapshot: 1000,
      })
      .select("id")
      .single();
    if (sale.error || !sale.data) {
      throw new Error(`sale fixture failed: ${sale.error?.message ?? "no row"}`);
    }
    saleByB = sale.data;
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
});
