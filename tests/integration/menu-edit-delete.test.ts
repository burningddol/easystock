import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUser,
  createTestUser,
  hasSupabaseTestEnv,
  signInAs,
  type TestUser,
} from "../helpers/test-supabase";
import { cloneMenuTemplate, deleteMenu, editMenu, saveMenu } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * `edit_menu` / `delete_menu` RPC 통합 테스트.
 * - 본인 소유 메뉴 수정/삭제 정상
 * - 다른 사용자 메뉴 수정/삭제는 차단 (헌법 IV)
 * - 삭제는 soft (is_active=false), 과거 sale 참조 보존
 */

const describeMenuMutations = hasSupabaseTestEnv ? describe : describe.skip;

describeMenuMutations("edit_menu / delete_menu RPC", () => {
  let user: TestUser;
  let client: SupabaseClient<Database>;
  let ingredientId: string;

  beforeAll(async () => {
    user = await createTestUser({ storeType: "cafe" });
    client = await signInAs(user);

    await cloneMenuTemplate(client, { storeType: "cafe" });
    const ing = await client.from("ingredients").select("id").eq("name", "원두").single();
    ingredientId = ing.data!.id;
  }, 60_000);

  afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  }, 30_000);

  it("edit_menu — 이름/가격/레시피 수정", async () => {
    const created = await saveMenu(client, {
      name: "테스트라떼",
      price: 5000,
      recipe: [{ ingredientId, quantityPerServing: 20 }],
    });
    expect(created.error).toBeNull();
    const menuId = created.data![0]!.menu_id;

    const edited = await editMenu(client, {
      menuId,
      name: "테스트라떼-수정",
      price: 5500,
      recipe: [{ ingredientId, quantityPerServing: 25 }],
    });
    expect(edited.error).toBeNull();

    const after = await client
      .from("menus")
      .select("name, price, recipe_items(quantity_per_serving)")
      .eq("id", menuId)
      .single();
    expect(after.data!.name).toBe("테스트라떼-수정");
    expect(Number(after.data!.price)).toBe(5500);
    expect(after.data!.recipe_items).toHaveLength(1);
    expect(Number(after.data!.recipe_items[0]!.quantity_per_serving)).toBe(25);
  });

  it("delete_menu — soft delete (is_active=false)", async () => {
    const created = await saveMenu(client, {
      name: "삭제용메뉴",
      price: 3000,
      recipe: [],
    });
    const menuId = created.data![0]!.menu_id;

    const deleted = await deleteMenu(client, menuId);
    expect(deleted.error).toBeNull();
    expect(deleted.data![0]!.was_active).toBe(true);

    const row = await client.from("menus").select("is_active").eq("id", menuId).single();
    expect(row.data!.is_active).toBe(false);
  });

  it("다른 사용자 메뉴는 수정/삭제 불가 (헌법 IV)", async () => {
    const otherUser = await createTestUser({ storeType: "cafe" });
    const otherClient = await signInAs(otherUser);
    await cloneMenuTemplate(otherClient, { storeType: "cafe" });
    const otherMenu = await otherClient
      .from("menus")
      .select("id")
      .eq("name", "아메리카노")
      .single();
    const otherMenuId = otherMenu.data!.id;

    const edit = await editMenu(client, {
      menuId: otherMenuId,
      name: "해킹시도",
      price: 0,
      recipe: [],
    });
    expect(edit.error?.message).toMatch(/not_found_or_forbidden|permission/);

    const del = await deleteMenu(client, otherMenuId);
    expect(del.error?.message).toMatch(/not_found_or_forbidden|permission/);

    await cleanupTestUser(otherUser.id);
  });
});
