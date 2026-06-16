import {
  deleteMenu as deleteMenuRpc,
  editMenu as editMenuRpc,
  saveMenuOptions as saveMenuOptionsRpc,
  saveMenu as saveMenuRpc,
} from "@/lib/supabase/rpc";

interface RpcClient {
  rpc: unknown;
}

export interface SaveMenuInput {
  name: string;
  price: number;
  recipe: ReadonlyArray<{ ingredientId: string; quantityPerServing: number }>;
  optionGroups?: ReadonlyArray<{
    name: string;
    selectionType: "single" | "add_on";
    isRequired: boolean;
    minSelect: number;
    maxSelect?: number | null;
    values: ReadonlyArray<{
      name: string;
      priceDelta: number;
      isDefault: boolean;
      recipe: ReadonlyArray<{ ingredientId: string; quantityPerSelection: number }>;
    }>;
  }>;
}

export interface EditMenuInput extends SaveMenuInput {
  menuId: string;
}

export async function createMenu(client: RpcClient, input: SaveMenuInput): Promise<string> {
  const { data, error } = await saveMenuRpc(client, input);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("save_menu returned empty");
  await saveMenuOptions(client, row.menu_id, input.optionGroups ?? []);
  return row.menu_id;
}

export async function updateMenu(client: RpcClient, input: EditMenuInput): Promise<string> {
  const { data, error } = await editMenuRpc(client, input);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("edit_menu returned empty");
  await saveMenuOptions(client, input.menuId, input.optionGroups ?? []);
  return row.menu_id;
}

export async function removeMenu(client: RpcClient, menuId: string): Promise<void> {
  const { error } = await deleteMenuRpc(client, menuId);
  if (error) throw new Error(error.message);
}

async function saveMenuOptions(
  client: RpcClient,
  menuId: string,
  optionGroups: NonNullable<SaveMenuInput["optionGroups"]>,
): Promise<void> {
  const { error } = await saveMenuOptionsRpc(client, { menuId, optionGroups });
  if (error) throw new Error(error.message);
}
