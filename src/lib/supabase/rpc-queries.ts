import { callRpc, callRpcMapped, numeric, type ClientLike, type RpcResult } from "./rpc-core";

export interface DepletionForecastRow {
  ingredientId: string;
  name: string;
  unit: "g" | "ml" | "piece";
  currentStock: number;
  leadTimeDays: number;
  safetyBufferDays: number;
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
  safety_buffer_days: number;
  consumption_samples: Array<{ date: string; amount: number }>;
  signed_up_at: string;
  regular_days_off: Array<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN">;
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
      safetyBufferDays: row.safety_buffer_days,
      consumptionSamples: row.consumption_samples ?? [],
      signedUpAt: row.signed_up_at,
      regularDaysOff: row.regular_days_off ?? [],
    })),
    error: null,
  };
}
