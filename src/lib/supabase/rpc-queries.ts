import { callRpc, callRpcMapped, numeric, type ClientLike, type RpcResult } from "./rpc-core";

export interface DepletionForecastRow {
  ingredientId: string;
  name: string;
  unit: "g" | "ml" | "piece";
  currentStock: number;
  leadTimeDays: number;
  leadTimeVendorId: string | null;
  leadTimeVendorName: string | null;
  isDefaultLeadTime: boolean;
  safetyBufferDays: number;
  purchaseCoverageDays: number;
  forecastSensitivity: "stable" | "balanced" | "responsive";
  consumptionSamples: Array<{ date: string; amount: number }>;
  signedUpAt: string;
  regularDaysOff: ReadonlyArray<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
}

export interface MenuDemandForecastRow {
  menuId: string;
  name: string;
  price: number;
  isActive: boolean;
  baseRecipe: Array<{ ingredientId: string; quantityPerServing: number }>;
  optionGroups: Array<{
    optionGroupId: string;
    name: string;
    selectionType: "single" | "add_on";
    isRequired: boolean;
    values: Array<{
      optionValueId: string;
      name: string;
      isDefault: boolean;
      selectionRate: number;
      recipe: Array<{ ingredientId: string; quantityPerSelection: number }>;
    }>;
  }>;
  demandSamples: Array<{ date: string; quantity: number }>;
  forecastSensitivity: "stable" | "balanced" | "responsive";
  signedUpAt: string;
  regularDaysOff: ReadonlyArray<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
}

export interface OrderRecommendationReportData {
  summary: {
    snapshotCount: number;
    convertedCount: number;
    pendingCount: number;
  };
  snapshots: Array<{
    snapshotId: string;
    vendorId: string | null;
    vendorName: string | null;
    source: string;
    purchaseOrderId: string | null;
    purchasedAt: string | null;
    createdAt: string;
    items: Array<{
      ingredientId: string;
      ingredientName: string;
      unit: "g" | "ml" | "piece";
      recommendedQuantity: number;
      currentStock: number;
      expectedDepletionDate: string | null;
      orderByDate: string | null;
      leadTimeDays: number;
      safetyBufferDays: number;
      purchaseCoverageDays: number;
    }>;
  }>;
}

interface DepletionForecastRawRow {
  ingredient_id: string;
  name: string;
  unit: "g" | "ml" | "piece";
  current_stock: number;
  lead_time_days: number;
  lead_time_vendor_id?: string | null;
  lead_time_vendor_name: string | null;
  is_default_lead_time: boolean;
  safety_buffer_days?: number | null;
  purchase_coverage_days?: number | null;
  forecast_sensitivity?: "stable" | "balanced" | "responsive" | null;
  consumption_samples: Array<{ date: string; amount: number }>;
  signed_up_at: string;
  regular_days_off: Array<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
}

interface MenuDemandForecastRawRow {
  menu_id: string;
  name: string;
  price: number;
  is_active: boolean;
  base_recipe?: Array<{ ingredient_id: string; quantity_per_serving: number }> | null;
  option_groups?: Array<{
    option_group_id: string;
    name: string;
    selection_type: "single" | "add_on";
    is_required: boolean;
    values?: Array<{
      option_value_id: string;
      name: string;
      is_default: boolean;
      selection_rate: number;
      recipe?: Array<{ ingredient_id: string; quantity_per_selection: number }> | null;
    }> | null;
  }> | null;
  demand_samples: Array<{ date: string; quantity: number }>;
  forecast_sensitivity?: "stable" | "balanced" | "responsive" | null;
  signed_up_at: string;
  regular_days_off: Array<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
}

interface OrderRecommendationReportRaw {
  summary?: {
    snapshot_count?: number;
    converted_count?: number;
    pending_count?: number;
  };
  snapshots?: Array<{
    snapshot_id: string;
    vendor_id: string | null;
    vendor_name: string | null;
    source: string;
    purchase_order_id: string | null;
    purchased_at: string | null;
    created_at: string;
    items?: Array<{
      ingredient_id: string;
      ingredient_name: string;
      unit: "g" | "ml" | "piece";
      recommended_quantity: number;
      current_stock: number;
      expected_depletion_date: string | null;
      order_by_date: string | null;
      lead_time_days: number;
      safety_buffer_days: number;
      purchase_coverage_days: number;
    }>;
  }>;
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
      currentStock: numeric(row.current_stock),
      leadTimeDays: row.lead_time_days,
      leadTimeVendorId: row.lead_time_vendor_id ?? null,
      leadTimeVendorName: row.lead_time_vendor_name,
      isDefaultLeadTime: row.is_default_lead_time,
      safetyBufferDays:
        typeof row.safety_buffer_days === "number" && Number.isFinite(row.safety_buffer_days)
          ? row.safety_buffer_days
          : 1,
      purchaseCoverageDays:
        typeof row.purchase_coverage_days === "number" &&
        Number.isFinite(row.purchase_coverage_days)
          ? row.purchase_coverage_days
          : 7,
      forecastSensitivity: normalizeForecastSensitivity(row.forecast_sensitivity),
      consumptionSamples: row.consumption_samples ?? [],
      signedUpAt: row.signed_up_at,
      regularDaysOff: row.regular_days_off ?? [],
    })),
    error: null,
  };
}

export async function getMenuDemandForecast(
  client: ClientLike,
): Promise<RpcResult<MenuDemandForecastRow[]>> {
  const result = await callRpc<MenuDemandForecastRawRow[]>(client, "get_menu_demand_forecast");
  if (result.error) return { data: null, error: result.error };
  return {
    data: (result.data ?? []).map((row) => ({
      menuId: row.menu_id,
      name: row.name,
      price: numeric(row.price),
      isActive: row.is_active,
      baseRecipe: (row.base_recipe ?? []).map((item) => ({
        ingredientId: item.ingredient_id,
        quantityPerServing: numeric(item.quantity_per_serving),
      })),
      optionGroups: (row.option_groups ?? []).map((group) => ({
        optionGroupId: group.option_group_id,
        name: group.name,
        selectionType: group.selection_type,
        isRequired: group.is_required,
        values: (group.values ?? []).map((value) => ({
          optionValueId: value.option_value_id,
          name: value.name,
          isDefault: value.is_default,
          selectionRate: numeric(value.selection_rate),
          recipe: (value.recipe ?? []).map((item) => ({
            ingredientId: item.ingredient_id,
            quantityPerSelection: numeric(item.quantity_per_selection),
          })),
        })),
      })),
      demandSamples: row.demand_samples ?? [],
      forecastSensitivity: normalizeForecastSensitivity(row.forecast_sensitivity),
      signedUpAt: row.signed_up_at,
      regularDaysOff: row.regular_days_off ?? [],
    })),
    error: null,
  };
}

function normalizeForecastSensitivity(
  value: string | null | undefined,
): "stable" | "balanced" | "responsive" {
  if (value === "stable" || value === "responsive") return value;
  return "balanced";
}

export function getOrderRecommendationReport(
  client: ClientLike,
  limit = 30,
): Promise<RpcResult<OrderRecommendationReportData>> {
  return callRpcMapped<OrderRecommendationReportRaw, OrderRecommendationReportData>(
    client,
    "get_order_recommendation_report",
    { p_limit: limit },
    (raw) => ({
      summary: {
        snapshotCount: Number(raw.summary?.snapshot_count ?? 0),
        convertedCount: Number(raw.summary?.converted_count ?? 0),
        pendingCount: Number(raw.summary?.pending_count ?? 0),
      },
      snapshots: (raw.snapshots ?? []).map((snapshot) => ({
        snapshotId: snapshot.snapshot_id,
        vendorId: snapshot.vendor_id,
        vendorName: snapshot.vendor_name,
        source: snapshot.source,
        purchaseOrderId: snapshot.purchase_order_id,
        purchasedAt: snapshot.purchased_at,
        createdAt: snapshot.created_at,
        items: (snapshot.items ?? []).map((item) => ({
          ingredientId: item.ingredient_id,
          ingredientName: item.ingredient_name,
          unit: item.unit,
          recommendedQuantity: numeric(item.recommended_quantity),
          currentStock: numeric(item.current_stock),
          expectedDepletionDate: item.expected_depletion_date,
          orderByDate: item.order_by_date,
          leadTimeDays: Number(item.lead_time_days),
          safetyBufferDays: Number(item.safety_buffer_days),
          purchaseCoverageDays: Number(item.purchase_coverage_days),
        })),
      })),
    }),
  );
}
