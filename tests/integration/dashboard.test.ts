import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUser,
  createTestUser,
  getServiceRoleClient,
  isoDate,
  signInAs,
  type TestUser,
} from "../helpers/test-supabase";
import { describeIfSupabase } from "../helpers/integration-describe";
import { seedCafeWithBean } from "../helpers/fixtures";
import { getTodayDashboard } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * `get_today_dashboard` RPC 통합 테스트 (Phase 7 / T146).
 * - 어제 KPI 계산 (revenue, net_profit, margin)
 * - 7일 차트 7개 entry
 * - 지난주 같은 요일 비교 (admin client로 -8일 sale 직접 INSERT, save_sale 7일 윈도우 우회)
 * - missing_yesterday_sale 토글
 * - top3 메뉴 마진 정렬
 */

describeIfSupabase("get_today_dashboard RPC", () => {
  let user: TestUser;
  let client: SupabaseClient<Database>;
  let menuId: string;

  beforeAll(async () => {
    user = await createTestUser({ storeType: "cafe", storeName: "지영카페" });
    client = await signInAs(user);
    ({ menuId } = await seedCafeWithBean(client, user, { stock: 10000, avgPrice: 50 }));
  }, 60_000);

  afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  }, 30_000);

  it("어제 sale 없을 때 missing_yesterday_sale=true + KPI 0", async () => {
    const { data, error } = await getTodayDashboard(client);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.storeName).toBe("지영카페");
    expect(data!.missingYesterdaySale).toBe(true);
    expect(data!.yesterday.revenue).toBe(0);
    expect(data!.yesterday.netProfit).toBe(0);
    expect(data!.yesterday.marginPercent).toBe(0);
    expect(data!.weeklyChart).toHaveLength(7);
    expect(data!.top3Menus).toEqual([]);
  });

  it("다른 사용자의 sale은 누설되지 않는다 (헌법 IV)", async () => {
    const otherUser = await createTestUser({ storeType: "cafe", storeName: "다른가게" });
    const admin = getServiceRoleClient();

    // 다른 사용자에게 거대 매출 sale 직접 INSERT
    await admin.from("sales").insert({
      user_id: otherUser.id,
      sold_at: isoDate(-1),
      total_revenue: 999999,
      total_cost_snapshot: 0,
    });

    const { data, error } = await getTodayDashboard(client);
    expect(error).toBeNull();
    // 본인은 어제 sale 아직 없음 → revenue 0 / missing true 그대로
    expect(data!.yesterday.revenue).toBe(0);
    expect(data!.missingYesterdaySale).toBe(true);

    await cleanupTestUser(otherUser.id);
  });

  it("어제 + 8일 전 sale 직접 INSERT → KPI + 지난주 비교 + top3 채움", async () => {
    const admin = getServiceRoleClient();

    // 어제 sale: 아메리카노 4500원 × 5 = 22500, 원두 18g × 50원 × 5 = 4500 cost
    const yesterdaySale = await admin
      .from("sales")
      .insert({
        user_id: user.id,
        sold_at: isoDate(-1),
        total_revenue: 22500,
        total_cost_snapshot: 4500,
      })
      .select("id")
      .single();
    await admin.from("sale_items").insert({
      sale_id: yesterdaySale.data!.id,
      user_id: user.id,
      menu_id: menuId,
      quantity: 5,
      unit_price: 4500,
      menu_cost_snapshot: 900,
    });

    // 8일 전 sale (지난주 같은 요일): 매출 30000원 (어제보다 25% 낮음 → 어제 -25% 변화율 X, 어제가 22500/30000 = -25%)
    const lastWeekSale = await admin
      .from("sales")
      .insert({
        user_id: user.id,
        sold_at: isoDate(-8),
        total_revenue: 30000,
        total_cost_snapshot: 6000,
      })
      .select("id")
      .single();
    await admin.from("sale_items").insert({
      sale_id: lastWeekSale.data!.id,
      user_id: user.id,
      menu_id: menuId,
      quantity: 6,
      unit_price: 5000,
      menu_cost_snapshot: 1000,
    });

    const { data, error } = await getTodayDashboard(client);
    expect(error).toBeNull();

    expect(data!.missingYesterdaySale).toBe(false);
    expect(data!.yesterday.revenue).toBe(22500);
    expect(data!.yesterday.netProfit).toBe(18000);
    expect(data!.yesterday.marginPercent).toBe(80);
    expect(data!.yesterday.lastWeekRevenue).toBe(30000);
    expect(data!.yesterday.revenueChangePercent).toBe(-25);

    // top3에 아메리카노 1개 (이번 주 윈도우는 7일이라 -8일은 제외)
    expect(data!.top3Menus).toHaveLength(1);
    expect(data!.top3Menus[0]?.name).toBe("아메리카노");
    expect(data!.top3Menus[0]?.unitsSold).toBe(5);
    expect(data!.top3Menus[0]?.marginPercent).toBe(80);
    // 어제 차트 포인트 = 22500
    const lastEntry = data!.weeklyChart[data!.weeklyChart.length - 1];
    expect(lastEntry?.revenue).toBe(22500);
  });
});
