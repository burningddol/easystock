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

  beforeAll(async () => {
    userA = await createTestUser({ storeName: "A 가게" });
    userB = await createTestUser({ storeName: "B 가게" });
    clientA = await signInAs(userA);

    const admin = getServiceRoleClient();
    const { data, error } = await admin
      .from("ingredients")
      .insert({ user_id: userB.id, name: "B 우유", unit: "ml" })
      .select("id, user_id")
      .single();

    if (error || !data) {
      throw new Error(`fixture insert failed: ${error?.message ?? "no row"}`);
    }
    ingredientByB = data;
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
});
