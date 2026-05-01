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

/**
 * 첫 행만 사용하는 RPC 래퍼 — `apply_stock_count` / `save_purchase`처럼 SETOF 1건을
 * 반환하지만 호출 측은 단일 객체로 다루는 패턴 단일 출처. data[0]이 없으면 null.
 */
async function callRpcSingleRow<TRaw, TOut>(
  client: ClientLike,
  fn: string,
  args: Record<string, unknown>,
  mapRow: (row: TRaw) => TOut,
): Promise<RpcResult<TOut>> {
  const result = await callRpc<TRaw[]>(client, fn, args);
  if (result.error || !result.data?.[0]) {
    return { data: null, error: result.error };
  }
  return { data: mapRow(result.data[0]), error: null };
}

/** 단일 row payload(객체 1개)를 반환하는 RPC 래퍼 — `get_today_dashboard` 등. */
async function callRpcMapped<TRaw, TOut>(
  client: ClientLike,
  fn: string,
  args: Record<string, unknown> | undefined,
  map: (raw: TRaw) => TOut,
): Promise<RpcResult<TOut>> {
  const result = await callRpc<TRaw>(client, fn, args);
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }
  return { data: map(result.data), error: null };
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

// 도메인 타입 → RPC payload 변환 어댑터 — saveMenu / editMenu / saveSale / editSale 4곳 공유.
function mapRecipePayload(
  recipe: SaveMenuArgs["recipe"],
): Array<{ ingredient_id: string; quantity_per_serving: number }> {
  return recipe.map((it) => ({
    ingredient_id: it.ingredientId,
    quantity_per_serving: it.quantityPerServing,
  }));
}

function mapSaleItemsPayload(
  items: ReadonlyArray<{ menuId: string; quantity: number }>,
): Array<{ menu_id: string; quantity: number }> {
  return items.map((it) => ({ menu_id: it.menuId, quantity: it.quantity }));
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
    p_items: mapSaleItemsPayload(args.items),
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
      weeklyLossAmount: Number(row.weekly_loss_amount),
      itemDifferences: row.item_differences.map((d) => ({
        ingredientId: d.ingredient_id,
        name: d.name,
        systemStock: Number(d.system_stock),
        actualStock: Number(d.actual_stock),
        diff: Number(d.diff),
        lossAmount: Number(d.loss_amount),
      })),
    }),
  );
}

export interface DepletionForecastRow {
  ingredientId: string;
  name: string;
  unit: "g" | "ml" | "piece";
  currentStock: number;
  leadTimeDays: number;
  consumptionSamples: Array<{ date: string; amount: number }>;
  signedUpAt: string;
  regularDaysOff: ReadonlyArray<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
}

interface DepletionForecastRawRow {
  ingredient_id: string;
  name: string;
  unit: "g" | "ml" | "piece";
  current_stock: number;
  lead_time_days: number;
  consumption_samples: Array<{ date: string; amount: number }>;
  signed_up_at: string;
  regular_days_off: Array<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
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

export interface CalendarCumulative {
  totalRevenue: number;
  totalNetProfit: number;
  avgDailyRevenue: number;
  operatingDays: number;
}

export interface CalendarCell {
  date: string;
  isFuture: boolean;
  isBeforeSignup: boolean;
  isRegularDayOff: boolean;
  hasSale: boolean;
  hasPurchase: boolean;
  isMissing: boolean;
  revenue: number | null;
  netProfit: number | null;
}

export interface CalendarMonthData {
  year: number;
  month: number;
  cumulative: CalendarCumulative;
  cells: CalendarCell[];
  marginLabel: string;
}

interface CalendarMonthRaw {
  year: number;
  month: number;
  cumulative: {
    total_revenue: number;
    total_net_profit: number;
    avg_daily_revenue: number;
    operating_days: number;
  };
  cells: Array<{
    date: string;
    is_future: boolean;
    is_before_signup: boolean;
    is_regular_day_off: boolean;
    has_sale: boolean;
    has_purchase: boolean;
    is_missing: boolean;
    revenue: number | null;
    net_profit: number | null;
  }>;
  margin_label: string;
}

export function getCalendarMonth(
  client: ClientLike,
  args: { year: number; month: number },
): Promise<RpcResult<CalendarMonthData>> {
  return callRpcMapped<CalendarMonthRaw, CalendarMonthData>(
    client,
    "get_calendar_month",
    { p_year: args.year, p_month: args.month },
    (raw) => ({
      year: raw.year,
      month: raw.month,
      cumulative: {
        totalRevenue: raw.cumulative.total_revenue,
        totalNetProfit: raw.cumulative.total_net_profit,
        avgDailyRevenue: raw.cumulative.avg_daily_revenue,
        operatingDays: raw.cumulative.operating_days,
      },
      cells: raw.cells.map((c) => ({
        date: c.date,
        isFuture: c.is_future,
        isBeforeSignup: c.is_before_signup,
        isRegularDayOff: c.is_regular_day_off,
        hasSale: c.has_sale,
        hasPurchase: c.has_purchase,
        isMissing: c.is_missing,
        revenue: c.revenue,
        netProfit: c.net_profit,
      })),
      marginLabel: raw.margin_label,
    }),
  );
}

export interface DashboardYesterday {
  soldAt: string;
  revenue: number;
  netProfit: number;
  marginPercent: number;
  lastWeekRevenue: number;
  revenueChangePercent: number | null;
}

export interface DashboardWeeklyChartPoint {
  soldAt: string;
  revenue: number;
}

export interface DashboardExpiryAlert {
  ingredientId: string;
  name: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

export interface DashboardTopMenu {
  menuId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  netProfit: number;
  marginPercent: number;
}

export interface DashboardLowMarginMenu {
  menuId: string;
  name: string;
  marginPercent: number;
  cause: string | null;
}

export interface TodayDashboardData {
  storeName: string;
  yesterday: DashboardYesterday;
  weeklyChart: DashboardWeeklyChartPoint[];
  expiryAlerts: DashboardExpiryAlert[];
  missingYesterdaySale: boolean;
  top3Menus: DashboardTopMenu[];
  lowMarginMenu: DashboardLowMarginMenu | null;
}

// jsonb_build_object 가 numeric을 JSON number로 직렬화하므로 이 RPC는 모든 숫자가
// 런타임에서 number 타입. snake_case → camelCase 매핑만 수행.
interface TodayDashboardRaw {
  store_name: string;
  yesterday: {
    sold_at: string;
    revenue: number;
    net_profit: number;
    margin_percent: number;
    last_week_revenue: number;
    revenue_change_percent: number | null;
  };
  weekly_chart: Array<{ sold_at: string; revenue: number }>;
  expiry_alerts: Array<{
    ingredient_id: string;
    name: string;
    expiry_date: string;
    days_until_expiry: number;
  }>;
  missing_yesterday_sale: boolean;
  top3_menus: Array<{
    menu_id: string;
    name: string;
    units_sold: number;
    revenue: number;
    net_profit: number;
    margin_percent: number;
  }>;
  low_margin_menu: {
    menu_id: string;
    name: string;
    margin_percent: number;
    cause: string | null;
  } | null;
}

export function getTodayDashboard(client: ClientLike): Promise<RpcResult<TodayDashboardData>> {
  return callRpcMapped<TodayDashboardRaw, TodayDashboardData>(
    client,
    "get_today_dashboard",
    undefined,
    (raw) => ({
      storeName: raw.store_name,
      yesterday: {
        soldAt: raw.yesterday.sold_at,
        revenue: raw.yesterday.revenue,
        netProfit: raw.yesterday.net_profit,
        marginPercent: raw.yesterday.margin_percent,
        lastWeekRevenue: raw.yesterday.last_week_revenue,
        revenueChangePercent: raw.yesterday.revenue_change_percent,
      },
      weeklyChart: raw.weekly_chart.map((p) => ({
        soldAt: p.sold_at,
        revenue: p.revenue,
      })),
      expiryAlerts: raw.expiry_alerts.map((e) => ({
        ingredientId: e.ingredient_id,
        name: e.name,
        expiryDate: e.expiry_date,
        daysUntilExpiry: e.days_until_expiry,
      })),
      missingYesterdaySale: raw.missing_yesterday_sale,
      top3Menus: raw.top3_menus.map((m) => ({
        menuId: m.menu_id,
        name: m.name,
        unitsSold: m.units_sold,
        revenue: m.revenue,
        netProfit: m.net_profit,
        marginPercent: m.margin_percent,
      })),
      lowMarginMenu: raw.low_margin_menu
        ? {
            menuId: raw.low_margin_menu.menu_id,
            name: raw.low_margin_menu.name,
            marginPercent: raw.low_margin_menu.margin_percent,
            cause: raw.low_margin_menu.cause,
          }
        : null,
    }),
  );
}

// SETOF — 빈 결과를 [] 로 정규화 (`callRpcMapped`는 data === null을 RPC 실패로 보므로
// 여기는 직접 처리). UI는 forecast 비어있어도 정상 렌더링해야 함.
export async function getDepletionForecast(
  client: ClientLike,
): Promise<RpcResult<DepletionForecastRow[]>> {
  const result = await callRpc<DepletionForecastRawRow[]>(client, "get_depletion_forecast");
  if (result.error) return { data: null, error: result.error };
  return {
    data: (result.data ?? []).map((row) => ({
      ingredientId: row.ingredient_id,
      name: row.name,
      unit: row.unit,
      currentStock: Number(row.current_stock),
      leadTimeDays: row.lead_time_days,
      consumptionSamples: row.consumption_samples ?? [],
      signedUpAt: row.signed_up_at,
      regularDaysOff: row.regular_days_off ?? [],
    })),
    error: null,
  };
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
        previousAvgPrice: Number(a.previous_avg_price),
        newAvgPrice: Number(a.new_avg_price),
        changePercent: Number(a.change_percent),
      })),
    }),
  );
}
