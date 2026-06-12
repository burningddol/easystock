type LookupRow = Record<string, never>;
export type LookupClient = SupabaseLike;

interface SupabaseLike {
  from: (table: string) => {
    select: (query: string) => {
      order: (
        column: string,
      ) => PromiseLike<{ data: LookupRow[] | null; error: { message: string } | null }>;
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
      current_stock: number;
      current_avg_price: number;
    };
  }>;
  option_groups: Array<{
    id: string;
    name: string;
    selection_type: "single" | "add_on";
    is_required: boolean;
    min_select: number;
    max_select: number | null;
    values: Array<{
      id: string;
      name: string;
      price_delta: number;
      is_default: boolean;
      recipe_items: Array<{
        id: string;
        quantity_per_selection: number;
        ingredient: {
          id: string;
          name: string;
          unit: string;
          current_stock: number;
          current_avg_price: number;
        };
      }>;
    }>;
  }>;
}

interface RawIngredient {
  id: string;
  name: string;
  unit: string;
  current_stock: string | number;
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

interface RawOptionGroupRow {
  id: string;
  menu_id: string;
  name: string;
  selection_type: "single" | "add_on";
  is_required: boolean;
  min_select: number;
  max_select: number | null;
  is_active: boolean;
  sort_order: number;
}

interface RawOptionValueRow {
  id: string;
  option_group_id: string;
  name: string;
  price_delta: string | number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

interface RawOptionRecipeItem {
  id: string;
  option_value_id: string;
  quantity_per_selection: string | number;
  ingredient: RawIngredient | null;
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
    menu_name: string | null;
    quantity: number;
    unit_price: number;
    menu_cost_snapshot: number;
    options: Array<{
      id: string;
      option_group_id: string;
      option_value_id: string;
      quantity: number;
      group_name_snapshot: string;
      value_name_snapshot: string;
      price_delta_snapshot: number;
      option_cost_snapshot: number;
    }>;
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
    menu: { name: string } | null;
    quantity: number;
    unit_price: string | number;
    menu_cost_snapshot: string | number;
    sale_item_options?: Array<{
      id: string;
      option_group_id: string;
      option_value_id: string;
      quantity: number;
      group_name_snapshot: string;
      value_name_snapshot: string;
      price_delta_snapshot: string | number;
      option_cost_snapshot: string | number;
    }>;
  }>;
}

export async function loadMenus(client: SupabaseLike): Promise<MenuRowWithRecipe[]> {
  const menusQuery = client
    .from("menus")
    .select(
      `
      id, name, price, is_active,
      recipe_items (
        id,
        quantity_per_serving,
        ingredient:ingredients (
          id, name, unit, current_stock, current_avg_price
        )
      )
    `,
    )
    .eq("is_active", true)
    .order("name");
  const groupsQuery = client
    .from("menu_option_groups")
    .select(
      "id, menu_id, name, selection_type, is_required, min_select, max_select, is_active, sort_order",
    )
    .eq("is_active", true)
    .order("sort_order");
  const valuesQuery = client
    .from("menu_option_values")
    .select("id, option_group_id, name, price_delta, is_default, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  const recipeQuery = client
    .from("menu_option_value_recipe_items")
    .select(
      `
        id, option_value_id, quantity_per_selection,
        ingredient:ingredients (
          id, name, unit, current_stock, current_avg_price
        )
      `,
    )
    .order("id");

  const [menusResult, groupsResult, valuesResult, recipeResult] = await Promise.all([
    menusQuery,
    groupsQuery,
    valuesQuery,
    recipeQuery,
  ]);

  const { data: menus, error: menusError } = menusResult;
  const { data: groups, error: groupsError } = groupsResult;
  const { data: values, error: valuesError } = valuesResult;
  const { data: recipeItems, error: recipeError } = recipeResult;
  const firstError = menusError ?? groupsError ?? valuesError ?? recipeError;
  if (firstError) throw new Error(firstError.message);

  const rows = (menus ?? []) as unknown as RawMenuRow[];
  const groupRows = ((groups ?? []) as unknown as RawOptionGroupRow[]).filter(
    (group) => group.is_active,
  );
  const valueRows = ((values ?? []) as unknown as RawOptionValueRow[]).filter(
    (value) => value.is_active,
  );
  const recipeRows = (recipeItems ?? []) as unknown as RawOptionRecipeItem[];
  const valuesByGroup = new Map<string, RawOptionValueRow[]>();
  const recipesByValue = new Map<string, RawOptionRecipeItem[]>();

  for (const value of valueRows) {
    const list = valuesByGroup.get(value.option_group_id) ?? [];
    list.push(value);
    valuesByGroup.set(value.option_group_id, list);
  }

  for (const item of recipeRows) {
    const list = recipesByValue.get(item.option_value_id) ?? [];
    list.push(item);
    recipesByValue.set(item.option_value_id, list);
  }

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
          current_stock: Number(item.ingredient.current_stock),
          current_avg_price: Number(item.ingredient.current_avg_price),
        },
      })),
    option_groups: groupRows
      .filter((group) => group.menu_id === menu.id)
      .map((group) => ({
        id: group.id,
        name: group.name,
        selection_type: group.selection_type,
        is_required: group.is_required,
        min_select: group.min_select,
        max_select: group.max_select,
        values: (valuesByGroup.get(group.id) ?? []).map((value) => ({
          id: value.id,
          name: value.name,
          price_delta: Number(value.price_delta),
          is_default: value.is_default,
          recipe_items: (recipesByValue.get(value.id) ?? [])
            .filter(
              (item): item is RawOptionRecipeItem & { ingredient: RawIngredient } =>
                item.ingredient !== null,
            )
            .map((item) => ({
              id: item.id,
              quantity_per_selection: Number(item.quantity_per_selection),
              ingredient: {
                id: item.ingredient.id,
                name: item.ingredient.name,
                unit: item.ingredient.unit,
                current_stock: Number(item.ingredient.current_stock),
                current_avg_price: Number(item.ingredient.current_avg_price),
              },
            })),
        })),
      }))
      .filter((group) => group.values.length > 0),
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
      sale_items (
        id, menu_id, quantity, unit_price, menu_cost_snapshot,
        menu:menus (name),
        sale_item_options (
          id, option_group_id, option_value_id, quantity,
          group_name_snapshot, value_name_snapshot,
          price_delta_snapshot, option_cost_snapshot
        )
      )
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
      menu_name: si.menu?.name ?? null,
      quantity: si.quantity,
      unit_price: Number(si.unit_price),
      menu_cost_snapshot: Number(si.menu_cost_snapshot),
      options: (si.sale_item_options ?? []).map((option) => ({
        id: option.id,
        option_group_id: option.option_group_id,
        option_value_id: option.option_value_id,
        quantity: option.quantity,
        group_name_snapshot: option.group_name_snapshot,
        value_name_snapshot: option.value_name_snapshot,
        price_delta_snapshot: Number(option.price_delta_snapshot),
        option_cost_snapshot: Number(option.option_cost_snapshot),
      })),
    })),
  };
}
