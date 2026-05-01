import { afterAll, beforeAll, expect, it } from "vitest";
import {
  backdateSignup,
  cleanupTestUser,
  createTestUser,
  getServiceRoleClient,
  signInAs,
  type TestUser,
} from "../helpers/test-supabase";
import { describeIfSupabase } from "../helpers/integration-describe";
import { cloneMenuTemplate, getCalendarMonth } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * `get_calendar_month` RPC 통합 테스트 (Phase 8 / T155).
 * - 일별 셀 정확도 (sale 있는 날 has_sale=true / 없는 날 is_missing 판별)
 * - 정기휴무 요일 처리 (FR-043, FR-045)
 * - 누적 KPI 계산
 * - 월 길이 (28~31일)에 따른 셀 개수
 * - RLS: 다른 사용자 데이터 leak 차단
 */

describeIfSupabase("get_calendar_month RPC", () => {
  let user: TestUser;
  let client: SupabaseClient<Database>;
  let menuId: string;

  beforeAll(async () => {
    user = await createTestUser({ storeType: "cafe", storeName: "달력카페" });
    client = await signInAs(user);

    const cloneResult = await cloneMenuTemplate(client, { storeType: "cafe" });
    expect(cloneResult.error).toBeNull();
    const menu = await client.from("menus").select("id").eq("name", "아메리카노").single();
    menuId = menu.data!.id;

    // 1월 셀의 is_before_signup=false를 보장하려면 가입일이 1월 이전이어야 함.
    await backdateSignup(user.id, "2025-12-01");
    const admin = getServiceRoleClient();
    const ing = await admin
      .from("ingredients")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "원두")
      .single();
    await admin
      .from("ingredients")
      .update({ current_stock: 10000, current_avg_price: 50 })
      .eq("id", ing.data!.id);
  }, 60_000);

  afterAll(async () => {
    if (user?.id) await cleanupTestUser(user.id);
  }, 30_000);

  it("2026년 2월 (28일) 빈 데이터: 28개 셀 + 누적 0", async () => {
    const { data, error } = await getCalendarMonth(client, { year: 2026, month: 2 });
    expect(error).toBeNull();
    expect(data!.year).toBe(2026);
    expect(data!.month).toBe(2);
    expect(data!.cells).toHaveLength(28);
    expect(data!.cumulative.totalRevenue).toBe(0);
    expect(data!.cumulative.operatingDays).toBe(0);
    expect(data!.marginLabel).toBe("재료 원가 기준 (이동평균법)");
  });

  it("2026년 1월 (31일): sale 2건 INSERT 후 누적/셀 정확도", async () => {
    const admin = getServiceRoleClient();

    // 1월 5일 매출 + 1월 10일 매출 + 1월 8일 매입
    const sale1 = await admin
      .from("sales")
      .insert({
        user_id: user.id,
        sold_at: "2026-01-05",
        total_revenue: 50000,
        total_cost_snapshot: 10000,
      })
      .select("id")
      .single();
    await admin.from("sale_items").insert({
      sale_id: sale1.data!.id,
      user_id: user.id,
      menu_id: menuId,
      quantity: 10,
      unit_price: 5000,
      menu_cost_snapshot: 1000,
    });

    const sale2 = await admin
      .from("sales")
      .insert({
        user_id: user.id,
        sold_at: "2026-01-10",
        total_revenue: 30000,
        total_cost_snapshot: 6000,
      })
      .select("id")
      .single();
    await admin.from("sale_items").insert({
      sale_id: sale2.data!.id,
      user_id: user.id,
      menu_id: menuId,
      quantity: 6,
      unit_price: 5000,
      menu_cost_snapshot: 1000,
    });

    // 1월 8일 매입 (vendor 필요)
    const vendor = await admin
      .from("vendors")
      .insert({ user_id: user.id, name: "거래처A", lead_time_days: 1 })
      .select("id")
      .single();
    await admin.from("purchase_orders").insert({
      user_id: user.id,
      vendor_id: vendor.data!.id,
      purchased_at: "2026-01-08",
      total_amount: 50000,
    });

    const { data, error } = await getCalendarMonth(client, { year: 2026, month: 1 });
    expect(error).toBeNull();
    expect(data!.cells).toHaveLength(31);

    // 누적: 매출 80000, 순익 64000, 영업일 2, 일평균 40000
    expect(data!.cumulative.totalRevenue).toBe(80000);
    expect(data!.cumulative.totalNetProfit).toBe(64000);
    expect(data!.cumulative.operatingDays).toBe(2);
    expect(data!.cumulative.avgDailyRevenue).toBe(40000);

    const day5 = data!.cells.find((c) => c.date === "2026-01-05")!;
    expect(day5.hasSale).toBe(true);
    expect(day5.isMissing).toBe(false);
    expect(day5.revenue).toBe(50000);
    expect(day5.netProfit).toBe(40000);

    const day8 = data!.cells.find((c) => c.date === "2026-01-08")!;
    expect(day8.hasSale).toBe(false);
    expect(day8.hasPurchase).toBe(true);
    expect(day8.isMissing).toBe(true);

    const day10 = data!.cells.find((c) => c.date === "2026-01-10")!;
    expect(day10.hasSale).toBe(true);
    expect(day10.revenue).toBe(30000);
  });

  it("정기휴무 요일 + FR-045 예외 영업 (sale 있는 정기휴무일은 영업으로)", async () => {
    const admin = getServiceRoleClient();

    // 월요일 정기휴무 설정. 2026-01-05는 월요일 (sale 있음, 예외 영업)
    // 2026-01-12는 월요일 (sale 없음, 정기휴무로 표시되어야)
    await admin
      .from("users")
      .update({ regular_days_off: ["MON"] })
      .eq("id", user.id);

    // 1/12은 sale 없는 월요일 — 정기휴무 + 누락 아님
    // 1/19도 sale 없는 월요일 — 정기휴무 + 누락 아님
    const { data, error } = await getCalendarMonth(client, { year: 2026, month: 1 });
    expect(error).toBeNull();

    const day5 = data!.cells.find((c) => c.date === "2026-01-05")!; // 월요일 + sale
    expect(day5.isRegularDayOff).toBe(false);
    expect(day5.hasSale).toBe(true);
    expect(day5.isMissing).toBe(false);

    const day12 = data!.cells.find((c) => c.date === "2026-01-12")!; // 월요일 + sale 없음
    expect(day12.isRegularDayOff).toBe(true);
    expect(day12.hasSale).toBe(false);
    expect(day12.isMissing).toBe(false);

    // 사후 정리: 정기휴무 원복 (다음 테스트에 영향 안 가도록)
    await admin.from("users").update({ regular_days_off: [] }).eq("id", user.id);
  });

  it("다른 사용자 sale/purchase 누설 차단 (헌법 IV)", async () => {
    const otherUser = await createTestUser({ storeType: "cafe" });
    const admin = getServiceRoleClient();
    await admin.from("sales").insert({
      user_id: otherUser.id,
      sold_at: "2026-02-15",
      total_revenue: 999999,
      total_cost_snapshot: 0,
    });

    const { data } = await getCalendarMonth(client, { year: 2026, month: 2 });
    // 본인 시점 2월은 비어있어야 함
    expect(data!.cumulative.totalRevenue).toBe(0);
    const day15 = data!.cells.find((c) => c.date === "2026-02-15")!;
    expect(day15.hasSale).toBe(false);

    await cleanupTestUser(otherUser.id);
  });
});
