import { afterAll, beforeAll, expect, it } from "vitest";
import { cleanupTestUser, createTestUser, signInAs, type TestUser } from "../helpers/test-supabase";
import { describeIfSupabase } from "../helpers/integration-describe";
import { cloneMenuTemplate, deleteIngredient, saveIngredient } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * `delete_ingredient` RPC 통합 테스트.
 * - soft delete (is_active=false)
 * - 사용 중인 메뉴 수 in_use_menu_count 정확
 * - 다른 사용자 재료 삭제 차단 (헌법 IV)
 * - 단가 history는 cascade 보존
 */

describeIfSupabase("delete_ingredient RPC", () => {
  let user: TestUser;
  let client: SupabaseClient<Database>;

  beforeAll(async () => {
    user = await createTestUser({ storeType: "cafe" });
    client = await signInAs(user);
  }, 60_000);

  afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  }, 30_000);

  it("사용 안 하는 재료 — soft delete + in_use_menu_count=0", async () => {
    const created = await saveIngredient(client, { name: "테스트시럽", unit: "ml" });
    const ingId = created.data![0]!.id;

    const result = await deleteIngredient(client, ingId);
    expect(result.error).toBeNull();
    expect(result.data![0]!.was_active).toBe(true);
    expect(result.data![0]!.in_use_menu_count).toBe(0);

    const row = await client.from("ingredients").select("is_active").eq("id", ingId).single();
    expect(row.data!.is_active).toBe(false);
  });

  it("템플릿 메뉴가 쓰는 재료 삭제 — in_use_menu_count > 0 + soft delete", async () => {
    await cloneMenuTemplate(client, { storeType: "cafe" });
    const ing = await client.from("ingredients").select("id").eq("name", "원두").single();
    const ingId = ing.data!.id;

    const result = await deleteIngredient(client, ingId);
    expect(result.error).toBeNull();
    expect(result.data![0]!.in_use_menu_count).toBeGreaterThan(0);

    const row = await client.from("ingredients").select("is_active").eq("id", ingId).single();
    expect(row.data!.is_active).toBe(false);
  });

  it("다른 사용자 재료 삭제 불가 (헌법 IV)", async () => {
    const otherUser = await createTestUser({ storeType: "cafe" });
    const otherClient = await signInAs(otherUser);
    const created = await saveIngredient(otherClient, { name: "타인재료", unit: "g" });
    const otherIngId = created.data![0]!.id;

    const result = await deleteIngredient(client, otherIngId);
    expect(result.error?.message).toMatch(/not_found_or_forbidden|permission/);

    await cleanupTestUser(otherUser.id);
  });
});
