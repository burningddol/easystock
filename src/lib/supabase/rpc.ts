import type { Database } from "./types";
import { callRpc, callRpcSingleRow, numeric, type ClientLike, type RpcResult } from "./rpc-core";
export * from "./rpc-queries";

type Weekday = Database["public"]["Enums"]["weekday"];
type StoreType = Database["public"]["Enums"]["store_type"];

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

interface SaveMenuOptionsArgs {
  menuId: string;
  optionGroups: ReadonlyArray<{
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

// 도메인 타입 → RPC payload 변환 어댑터 — saveMenu / editMenu / saveSale / editSale 4곳 공유.
function mapRecipePayload(
  recipe: SaveMenuArgs["recipe"],
): Array<{ ingredient_id: string; quantity_per_serving: number }> {
  return recipe.map((it) => ({
    ingredient_id: it.ingredientId,
    quantity_per_serving: it.quantityPerServing,
  }));
}

interface SaleItemOptionInput {
  optionValueId: string;
  quantity: number;
}

interface SaleItemInput {
  menuId: string;
  quantity: number;
  options?: ReadonlyArray<SaleItemOptionInput>;
}

function mapSaleItemsPayload(items: ReadonlyArray<SaleItemInput>): Array<{
  menu_id: string;
  quantity: number;
  options?: Array<{ option_value_id: string; quantity: number }>;
}> {
  return items.map((it) => ({
    menu_id: it.menuId,
    quantity: it.quantity,
    ...(it.options
      ? {
          options: it.options.map((option) => ({
            option_value_id: option.optionValueId,
            quantity: option.quantity,
          })),
        }
      : {}),
  }));
}

interface EditMenuArgs extends SaveMenuArgs {
  menuId: string;
}

interface DeleteMenuRow {
  menu_id: string;
  was_active: boolean;
}

export function editMenu(
  client: ClientLike,
  args: EditMenuArgs,
): Promise<RpcResult<SaveMenuRow[]>> {
  return callRpc(client, "edit_menu", {
    p_menu_id: args.menuId,
    p_name: args.name,
    p_price: args.price,
    p_recipe: mapRecipePayload(args.recipe),
  });
}

export function deleteMenu(
  client: ClientLike,
  menuId: string,
): Promise<RpcResult<DeleteMenuRow[]>> {
  return callRpc(client, "delete_menu", { p_menu_id: menuId });
}

interface DeleteIngredientRow {
  ingredient_id: string;
  was_active: boolean;
  in_use_menu_count: number;
}

export function deleteIngredient(
  client: ClientLike,
  ingredientId: string,
): Promise<RpcResult<DeleteIngredientRow[]>> {
  return callRpc(client, "delete_ingredient", { p_ingredient_id: ingredientId });
}

export function saveMenu(
  client: ClientLike,
  args: SaveMenuArgs,
): Promise<RpcResult<SaveMenuRow[]>> {
  return callRpc(client, "save_menu", {
    p_name: args.name,
    p_price: args.price,
    p_recipe: mapRecipePayload(args.recipe),
  });
}

export function saveMenuOptions(
  client: ClientLike,
  args: SaveMenuOptionsArgs,
): Promise<
  RpcResult<Array<{ menu_id: string; option_group_count: number; option_value_count: number }>>
> {
  return callRpc(client, "save_menu_options", {
    p_menu_id: args.menuId,
    p_option_groups: args.optionGroups.map((group, groupIdx) => ({
      name: group.name,
      selection_type: group.selectionType,
      is_required: group.isRequired,
      min_select: group.minSelect,
      max_select: group.maxSelect ?? null,
      sort_order: groupIdx,
      values: group.values.map((value, valueIdx) => ({
        name: value.name,
        price_delta: value.priceDelta,
        is_default: value.isDefault,
        sort_order: valueIdx,
        recipe: value.recipe.map((item) => ({
          ingredient_id: item.ingredientId,
          quantity_per_selection: item.quantityPerSelection,
        })),
      })),
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
  items: ReadonlyArray<SaleItemInput>;
}

export function saveSale(client: ClientLike, args: SaveSaleArgs): Promise<RpcResult<SaleRpcRow[]>> {
  return callRpc(client, "save_sale", {
    p_sold_at: args.soldAt,
    p_items: mapSaleItemsPayload(args.items),
  });
}

interface EditSaleArgs {
  saleId: string;
  newItems: ReadonlyArray<SaleItemInput>;
  reason?: string;
}

export function editSale(client: ClientLike, args: EditSaleArgs): Promise<RpcResult<SaleRpcRow[]>> {
  return callRpc(client, "edit_sale", {
    p_sale_id: args.saleId,
    p_new_items: mapSaleItemsPayload(args.newItems),
    p_reason: args.reason ?? null,
  });
}

export function deleteSale(client: ClientLike, saleId: string): Promise<RpcResult<null>> {
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

interface ApplyStockCountArgs {
  countedAt: string;
  items: ReadonlyArray<{ ingredientId: string; actualStock: number }>;
}

export interface StockCountDifference {
  ingredientId: string;
  name: string;
  systemStock: number;
  actualStock: number;
  diff: number;
  lossAmount: number;
}

export interface ApplyStockCountResult {
  stockCountId: string;
  weeklyLossAmount: number;
  itemDifferences: StockCountDifference[];
}

interface ApplyStockCountRawRow {
  stock_count_id: string;
  weekly_loss_amount: number;
  item_differences: Array<{
    ingredient_id: string;
    name: string;
    system_stock: number;
    actual_stock: number;
    diff: number;
    loss_amount: number;
  }>;
}

export function applyStockCount(
  client: ClientLike,
  args: ApplyStockCountArgs,
): Promise<RpcResult<ApplyStockCountResult>> {
  return callRpcSingleRow<ApplyStockCountRawRow, ApplyStockCountResult>(
    client,
    "apply_stock_count",
    {
      p_counted_at: args.countedAt,
      p_items: args.items.map((it) => ({
        ingredient_id: it.ingredientId,
        actual_stock: it.actualStock,
      })),
    },
    (row) => ({
      stockCountId: row.stock_count_id,
      weeklyLossAmount: numeric(row.weekly_loss_amount),
      itemDifferences: row.item_differences.map((d) => ({
        ingredientId: d.ingredient_id,
        name: d.name,
        systemStock: numeric(d.system_stock),
        actualStock: numeric(d.actual_stock),
        diff: numeric(d.diff),
        lossAmount: numeric(d.loss_amount),
      })),
    }),
  );
}

interface ApplyInventoryReplayArgs {
  fromDate: string;
  note?: string;
}

export interface ApplyInventoryReplayResult {
  replayRunId: string;
  affectedIngredientCount: number;
  stockDeltaTotal: number;
  avgPriceDeltaTotal: number;
}

interface ApplyInventoryReplayRawRow {
  replay_run_id: string;
  affected_ingredient_count: number;
  stock_delta_total: number;
  avg_price_delta_total: number;
}

export function applyInventoryReplay(
  client: ClientLike,
  args: ApplyInventoryReplayArgs,
): Promise<RpcResult<ApplyInventoryReplayResult>> {
  return callRpcSingleRow<ApplyInventoryReplayRawRow, ApplyInventoryReplayResult>(
    client,
    "apply_inventory_replay",
    {
      p_from_date: args.fromDate,
      p_note: args.note ?? null,
    },
    (row) => ({
      replayRunId: row.replay_run_id,
      affectedIngredientCount: Number(row.affected_ingredient_count),
      stockDeltaTotal: numeric(row.stock_delta_total),
      avgPriceDeltaTotal: numeric(row.avg_price_delta_total),
    }),
  );
}

interface ApplySaleSnapshotRewriteArgs {
  fromDate: string;
  note?: string;
}

export interface ApplySaleSnapshotRewriteResult {
  replayRunId: string;
  affectedSaleCount: number;
  affectedItemCount: number;
  totalCostDelta: number;
}

interface ApplySaleSnapshotRewriteRawRow {
  replay_run_id: string;
  affected_sale_count: number;
  affected_item_count: number;
  total_cost_delta: number;
}

export function applySaleSnapshotRewrite(
  client: ClientLike,
  args: ApplySaleSnapshotRewriteArgs,
): Promise<RpcResult<ApplySaleSnapshotRewriteResult>> {
  return callRpcSingleRow<ApplySaleSnapshotRewriteRawRow, ApplySaleSnapshotRewriteResult>(
    client,
    "apply_sale_snapshot_rewrite",
    {
      p_from_date: args.fromDate,
      p_note: args.note ?? null,
    },
    (row) => ({
      replayRunId: row.replay_run_id,
      affectedSaleCount: Number(row.affected_sale_count),
      affectedItemCount: Number(row.affected_item_count),
      totalCostDelta: numeric(row.total_cost_delta),
    }),
  );
}

interface SubscribePushArgs {
  endpoint: string;
  keysP256dh: string;
  keysAuth: string;
  userAgent?: string;
}

export function subscribePush(
  client: ClientLike,
  args: SubscribePushArgs,
): Promise<RpcResult<string>> {
  return callRpc(client, "subscribe_push", {
    p_endpoint: args.endpoint,
    p_keys_p256dh: args.keysP256dh,
    p_keys_auth: args.keysAuth,
    p_user_agent: args.userAgent ?? null,
  });
}

export function unsubscribePush(client: ClientLike, endpoint: string): Promise<RpcResult<null>> {
  return callRpc(client, "unsubscribe_push", { p_endpoint: endpoint });
}

export function savePurchase(
  client: ClientLike,
  args: SavePurchaseArgs,
): Promise<RpcResult<SavePurchaseResult>> {
  return callRpcSingleRow<SavePurchaseRawRow, SavePurchaseResult>(
    client,
    "save_purchase",
    {
      p_vendor_id: args.vendorId,
      p_purchased_at: args.purchasedAt,
      p_items: args.items.map((it) => ({
        ingredient_id: it.ingredientId,
        quantity: it.quantity,
        amount: it.amount,
      })),
    },
    (row) => ({
      purchaseOrderId: row.purchase_order_id,
      priceChangeAlerts: row.price_change_alerts.map((a) => ({
        ingredientId: a.ingredient_id,
        ingredientName: a.ingredient_name,
        previousAvgPrice: numeric(a.previous_avg_price),
        newAvgPrice: numeric(a.new_avg_price),
        changePercent: numeric(a.change_percent),
      })),
    }),
  );
}
