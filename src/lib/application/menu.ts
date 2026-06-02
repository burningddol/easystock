import { deleteMenu as deleteMenuRpc, editMenu as editMenuRpc, saveMenu as saveMenuRpc } from "@/lib/supabase/rpc";

interface RpcClient {
  rpc: unknown;
}

export interface SaveMenuInput {
  name: string;
  price: number;
  recipe: ReadonlyArray<{ ingredientId: string; quantityPerServing: number }>;
}

export interface EditMenuInput extends SaveMenuInput {
  menuId: string;
}

export async function createMenu(client: RpcClient, input: SaveMenuInput): Promise<string> {
  const { data, error } = await saveMenuRpc(client, input);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("save_menu returned empty");
  return row.menu_id;
}

export async function updateMenu(client: RpcClient, input: EditMenuInput): Promise<string> {
  const { data, error } = await editMenuRpc(client, input);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("edit_menu returned empty");
  return row.menu_id;
}

export async function removeMenu(client: RpcClient, menuId: string): Promise<void> {
  const { error } = await deleteMenuRpc(client, menuId);
  if (error) throw new Error(error.message);
}
