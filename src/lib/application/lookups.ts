type LookupRow = Record<string, never>;
export type LookupClient = SupabaseLike;

interface SupabaseLike {
  from: (table: string) => {
    select: (query: string) => {
      eq: (
        column: string,
        value: unknown,
      ) => {
        order: (
          column: string,
        ) => PromiseLike<{ data: LookupRow[] | null; error: { message: string } | null }>;
        maybeSingle: () => PromiseLike<{
          data: LookupRow | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export interface MenuRowWithRecipe {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  recipe_items: Array<{
    id: string;
    quantity_per_serving: number;
    ingredient: {
      id: string;
      name: string;
      unit: string;
      current_avg_price: number;
    };
  }>;
}

interface RawIngredient {
  id: string;
  name: string;
  unit: string;
  current_avg_price: string | number;
}

interface RawRecipeItem {
  id: string;
  quantity_per_serving: number;
  ingredient: RawIngredient | null;
}

interface RawMenuRow {
  id: string;
  name: string;
  price: string | number;
  is_active: boolean;
  recipe_items: RawRecipeItem[];
}

export interface VendorRow {
  id: string;
  name: string;
  lead_time_days: number;
}

export interface IngredientRow {
  id: string;
  name: string;
  unit: "g" | "ml" | "piece";
  current_avg_price: number;
}

export interface SaleWithItems {
  id: string;
  sold_at: string;
  created_at: string;
  total_revenue: number;
  total_cost_snapshot: number;
  items: Array<{
    id: string;
    menu_id: string;
    quantity: number;
    unit_price: number;
    menu_cost_snapshot: number;
  }>;
}

interface RawSaleRow {
  id: string;
  sold_at: string;
  created_at: string;
  total_revenue: string | number;
  total_cost_snapshot: string | number;
  sale_items: Array<{
    id: string;
    menu_id: string;
    quantity: number;
    unit_price: string | number;
    menu_cost_snapshot: string | number;
  }>;
}

export async function loadMenus(client: SupabaseLike): Promise<MenuRowWithRecipe[]> {
  const { data, error } = await client
    .from("menus")
    .select(
      `
      id, name, price, is_active,
      recipe_items (
        id,
        quantity_per_serving,
        ingredient:ingredients (
          id, name, unit, current_avg_price
        )
      )
    `,
    )
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as RawMenuRow[];
  return rows.map((menu) => ({
    id: menu.id,
    name: menu.name,
    price: Number(menu.price),
    is_active: menu.is_active,
    recipe_items: menu.recipe_items
      .filter(
        (item): item is RawRecipeItem & { ingredient: RawIngredient } => item.ingredient !== null,
      )
      .map((item) => ({
        id: item.id,
        quantity_per_serving: item.quantity_per_serving,
        ingredient: {
          id: item.ingredient.id,
          name: item.ingredient.name,
          unit: item.ingredient.unit,
          current_avg_price: Number(item.ingredient.current_avg_price),
        },
      })),
  }));
}

export async function loadVendors(client: SupabaseLike): Promise<VendorRow[]> {
  const { data, error } = await client
    .from("vendors")
    .select("id, name, lead_time_days")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as unknown as Array<
      Omit<VendorRow, "lead_time_days"> & { lead_time_days: string | number }
    >
  ).map((row) => ({
    id: row.id,
    name: row.name,
    lead_time_days: Number(row.lead_time_days),
  }));
}

export async function loadIngredients(client: SupabaseLike): Promise<IngredientRow[]> {
  const { data, error } = await client
    .from("ingredients")
    .select("id, name, unit, current_avg_price")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as unknown as Array<
      Omit<IngredientRow, "current_avg_price"> & { current_avg_price: string | number }
    >
  ).map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    current_avg_price: Number(row.current_avg_price),
  }));
}

export async function loadSaleByDate(
  client: SupabaseLike,
  date: string,
): Promise<SaleWithItems | null> {
  const { data, error } = await client
    .from("sales")
    .select(
      `
      id, sold_at, created_at, total_revenue, total_cost_snapshot,
      sale_items (id, menu_id, quantity, unit_price, menu_cost_snapshot)
    `,
    )
    .eq("sold_at", date)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as RawSaleRow;
  return {
    id: row.id,
    sold_at: row.sold_at,
    created_at: row.created_at,
    total_revenue: Number(row.total_revenue),
    total_cost_snapshot: Number(row.total_cost_snapshot),
    items: row.sale_items.map((si) => ({
      id: si.id,
      menu_id: si.menu_id,
      quantity: si.quantity,
      unit_price: Number(si.unit_price),
      menu_cost_snapshot: Number(si.menu_cost_snapshot),
    })),
  };
}
