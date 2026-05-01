import { afterAll, beforeAll, expect, it } from "vitest";
import {
  cleanupTestUser,
  createTestUser,
  describeIfSupabase,
  signInAs,
  type TestUser,
} from "../helpers/test-supabase";
import { cloneMenuTemplate } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * `clone_menu_template` RPC: 빙수카페 8종 / 카페 음료 10종 시드를
 * 사용자 가게에 복제. 같은 RPC를 두 번 호출해도 충돌 없이 idempotent.
 */

describeIfSupabase("clone_menu_template RPC", () => {
  let user: TestUser;
  let client: SupabaseClient<Database>;

  beforeAll(async () => {
    user = await createTestUser({ storeType: "bingsu_cafe" });
    client = await signInAs(user);
  }, 30_000);

  afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  }, 30_000);

  it("빙수카페 템플릿 호출 시 메뉴 8개 + 재료 셋이 만들어진다", async () => {
    const { data, error } = await cloneMenuTemplate(client, { storeType: "bingsu_cafe" });

    expect(error).toBeNull();
    expect(data?.[0]?.menu_ids).toHaveLength(8);
    expect((data?.[0]?.ingredient_ids ?? []).length).toBeGreaterThanOrEqual(8);

    const menus = await client.from("menus").select("id, name, price").order("name");
    expect(menus.data).toHaveLength(8);
    expect(menus.data?.map((m) => m.name)).toContain("팥빙수");
  });

  it("두 번째 호출은 idempotent — 메뉴 수 증가 없음, 새로 만든 menu_ids 빈 배열", async () => {
    const { data, error } = await cloneMenuTemplate(client, { storeType: "bingsu_cafe" });

    expect(error).toBeNull();
    expect(data?.[0]?.menu_ids ?? []).toHaveLength(0); // 모두 conflict skip
    expect(data?.[0]?.ingredient_ids ?? []).toHaveLength(0);

    const menus = await client.from("menus").select("id");
    expect(menus.data).toHaveLength(8);
  });

  it("recipe_items가 메뉴별로 정확히 연결됨", async () => {
    const palbingsuRow = await client
      .from("menus")
      .select("id, recipe_items (ingredient_id, quantity_per_serving)")
      .eq("name", "팥빙수")
      .single();

    expect(palbingsuRow.error).toBeNull();
    const items = palbingsuRow.data?.recipe_items ?? [];
    // 시드: 얼음 / 우유 / 팥 / 연유 = 4개
    expect(items).toHaveLength(4);
    expect(items.every((it) => it.quantity_per_serving > 0)).toBe(true);
  });

  it("다른 store_type 호출 시 같은 사용자가 또 메뉴 복제 가능 (이름 충돌 없는 한)", async () => {
    const { data, error } = await cloneMenuTemplate(client, { storeType: "cafe" });

    expect(error).toBeNull();
    expect(data?.[0]?.menu_ids).toHaveLength(10);

    const allMenus = await client.from("menus").select("name");
    expect(allMenus.data?.length).toBe(18); // 8 + 10
  });
});
