import type { Database } from "./types";

type Weekday = Database["public"]["Enums"]["weekday"];
type StoreType = Database["public"]["Enums"]["store_type"];

/**
 * 타입 있는 RPC 래퍼.
 *
 * Supabase v2 rpc() 제네릭이 자동 생성 Database 타입과 일부 추론 충돌이 있어
 * 런타임 결과를 명시 타입으로 단언한다 (이 wrapping이 unsafe-cast 지점).
 * 또한 분리된 변수에 rpc를 대입하면 `this` 바인딩이 끊겨 Supabase 내부
 * fetcher가 깨지므로 `Reflect.apply`로 client를 receiver로 유지.
 */

interface RpcResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface ClientLike {
  rpc: unknown;
}

async function callRpc<T>(
  client: ClientLike,
  fn: string,
  args?: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const rpcFn = client.rpc as (...rest: unknown[]) => PromiseLike<RpcResult<T>>;
  const result = await Reflect.apply(rpcFn, client, args === undefined ? [fn] : [fn, args]);
  return result;
}

interface UpdateRegularDaysOffArgs {
  p_days_off: readonly Weekday[];
}

interface UpdateRegularDaysOffRow {
  success: boolean;
  days_off: Weekday[];
}

export function updateRegularDaysOff(
  client: ClientLike,
  args: UpdateRegularDaysOffArgs,
): Promise<RpcResult<UpdateRegularDaysOffRow[]>> {
  return callRpc(client, "update_regular_days_off", { p_days_off: [...args.p_days_off] });
}

interface RequestWithdrawalRow {
  success: boolean;
  permanent_delete_at: string;
}

export function requestWithdrawal(client: ClientLike): Promise<RpcResult<RequestWithdrawalRow[]>> {
  return callRpc(client, "request_withdrawal");
}

interface CloneMenuTemplateRow {
  menu_ids: string[];
  ingredient_ids: string[];
}

export function cloneMenuTemplate(
  client: ClientLike,
  args: { storeType: StoreType },
): Promise<RpcResult<CloneMenuTemplateRow[]>> {
  return callRpc(client, "clone_menu_template", { p_store_type: args.storeType });
}

interface SaveMenuArgs {
  name: string;
  price: number;
  recipe: ReadonlyArray<{ ingredientId: string; quantityPerServing: number }>;
}

interface SaveMenuRow {
  menu_id: string;
}

export function saveMenu(
  client: ClientLike,
  args: SaveMenuArgs,
): Promise<RpcResult<SaveMenuRow[]>> {
  return callRpc(client, "save_menu", {
    p_name: args.name,
    p_price: args.price,
    p_recipe: args.recipe.map((it) => ({
      ingredient_id: it.ingredientId,
      quantity_per_serving: it.quantityPerServing,
    })),
  });
}

interface SaleRpcRow {
  sale_id: string;
  total_revenue: number;
  total_cost_snapshot: number;
  total_net_profit: number;
  margin_percent: number;
}

interface SaveSaleArgs {
  soldAt: string; // YYYY-MM-DD
  items: ReadonlyArray<{ menuId: string; quantity: number }>;
}

export function saveSale(client: ClientLike, args: SaveSaleArgs): Promise<RpcResult<SaleRpcRow[]>> {
  return callRpc(client, "save_sale", {
    p_sold_at: args.soldAt,
    p_items: args.items.map((it) => ({ menu_id: it.menuId, quantity: it.quantity })),
  });
}

interface EditSaleArgs {
  saleId: string;
  newItems: ReadonlyArray<{ menuId: string; quantity: number }>;
  reason?: string;
}

export function editSale(client: ClientLike, args: EditSaleArgs): Promise<RpcResult<SaleRpcRow[]>> {
  return callRpc(client, "edit_sale", {
    p_sale_id: args.saleId,
    p_new_items: args.newItems.map((it) => ({ menu_id: it.menuId, quantity: it.quantity })),
    p_reason: args.reason ?? null,
  });
}

export function deleteSale(client: ClientLike, saleId: string): Promise<RpcResult<unknown>> {
  return callRpc(client, "delete_sale", { p_sale_id: saleId });
}

interface SavePurchaseArgs {
  vendorId: string;
  purchasedAt: string; // YYYY-MM-DD
  items: ReadonlyArray<{ ingredientId: string; quantity: number; amount: number }>;
}

export interface PriceChangeAlert {
  ingredientId: string;
  ingredientName: string;
  previousAvgPrice: number;
  newAvgPrice: number;
  changePercent: number;
}

export interface SavePurchaseResult {
  purchaseOrderId: string;
  priceChangeAlerts: PriceChangeAlert[];
}

interface SavePurchaseRawRow {
  purchase_order_id: string;
  price_change_alerts: Array<{
    ingredient_id: string;
    ingredient_name: string;
    previous_avg_price: number;
    new_avg_price: number;
    change_percent: number;
  }>;
}

interface SaveVendorRow {
  id: string;
  name: string;
  lead_time_days: number;
}

export function saveVendor(
  client: ClientLike,
  args: { name: string; leadTimeDays: number },
): Promise<RpcResult<SaveVendorRow[]>> {
  return callRpc(client, "save_vendor", {
    p_name: args.name,
    p_lead_time_days: args.leadTimeDays,
  });
}

interface SaveIngredientRow {
  id: string;
  name: string;
  unit: "g" | "ml" | "piece";
  current_avg_price: number;
}

export function saveIngredient(
  client: ClientLike,
  args: { name: string; unit: "g" | "ml" | "piece" },
): Promise<RpcResult<SaveIngredientRow[]>> {
  return callRpc(client, "save_ingredient", {
    p_name: args.name,
    p_unit: args.unit,
  });
}

export async function savePurchase(
  client: ClientLike,
  args: SavePurchaseArgs,
): Promise<RpcResult<SavePurchaseResult>> {
  const result = await callRpc<SavePurchaseRawRow[]>(client, "save_purchase", {
    p_vendor_id: args.vendorId,
    p_purchased_at: args.purchasedAt,
    p_items: args.items.map((it) => ({
      ingredient_id: it.ingredientId,
      quantity: it.quantity,
      amount: it.amount,
    })),
  });

  if (result.error || !result.data?.[0]) {
    return { data: null, error: result.error };
  }

  const row = result.data[0];
  return {
    data: {
      purchaseOrderId: row.purchase_order_id,
      priceChangeAlerts: row.price_change_alerts.map((a) => ({
        ingredientId: a.ingredient_id,
        ingredientName: a.ingredient_name,
        previousAvgPrice: Number(a.previous_avg_price),
        newAvgPrice: Number(a.new_avg_price),
        changePercent: Number(a.change_percent),
      })),
    },
    error: null,
  };
}
