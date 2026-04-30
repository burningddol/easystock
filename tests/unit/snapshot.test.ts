import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/domain/_decimal";
import {
  computeSnapshotPreview,
  daysUntilLock,
  isSaleLocked,
  type MenuForSnapshot,
  type SaleItemInput,
} from "@/lib/domain/snapshot";

/**
 * 헌법 III: Sale 저장 시 메뉴 원가/판매가 스냅샷 영구 보존.
 * 클라이언트는 입력 폼 미리보기 (StickyTotalCard) 용으로 같은 로직을 사용.
 *
 * - computeSnapshotPreview: 입력 항목 → 매출/원가/순수익/마진율 (재료 원가 기준)
 * - isSaleLocked: 7일 초과 sale은 편집 잠금 (FR-030)
 */

const palbingsu: MenuForSnapshot = {
  id: "menu-1",
  name: "팥빙수",
  price: 9000,
  recipeItems: [
    { quantity: 300, avgPrice: 5 }, // 얼음 1500
    { quantity: 100, avgPrice: 8 }, // 우유 800
    { quantity: 80, avgPrice: 30 }, // 팥 2400
    { quantity: 20, avgPrice: 6 }, // 연유 120
  ],
};
// 메뉴 1개 원가 = 1500 + 800 + 2400 + 120 = 4820

const americano: MenuForSnapshot = {
  id: "menu-2",
  name: "아메리카노",
  price: 4500,
  recipeItems: [{ quantity: 18, avgPrice: 50 }], // 원두 900
};

describe("computeSnapshotPreview", () => {
  it("단일 메뉴 1개: 매출 / 원가 / 순수익", () => {
    const items: SaleItemInput[] = [{ menuId: "menu-1", quantity: 1 }];
    const result = computeSnapshotPreview(items, [palbingsu]);
    expect(result.totalRevenue.toString()).toBe("9000");
    expect(result.totalCost.toString()).toBe("4820");
    expect(result.totalNetProfit.toString()).toBe("4180");
    expect(result.marginRate.toFixed(2)).toBe("46.44");
  });

  it("복수 메뉴 합산", () => {
    const items: SaleItemInput[] = [
      { menuId: "menu-1", quantity: 2 },
      { menuId: "menu-2", quantity: 3 },
    ];
    const result = computeSnapshotPreview(items, [palbingsu, americano]);
    // revenue = 9000*2 + 4500*3 = 31500
    // cost = 4820*2 + 900*3 = 12340
    expect(result.totalRevenue.toString()).toBe("31500");
    expect(result.totalCost.toString()).toBe("12340");
    expect(result.totalNetProfit.toString()).toBe("19160");
  });

  it("라벨이 항상 MARGIN_LABEL과 일치 — UI 표시용", () => {
    const result = computeSnapshotPreview([{ menuId: "menu-1", quantity: 1 }], [palbingsu]);
    expect(result.label).toBe("재료 원가 기준 (이동평균법)");
  });

  it("itemBreakdown으로 메뉴별 스냅샷 반환 — 저장 RPC가 그대로 사용 가능", () => {
    const items: SaleItemInput[] = [{ menuId: "menu-1", quantity: 2 }];
    const result = computeSnapshotPreview(items, [palbingsu]);
    expect(result.itemBreakdown).toHaveLength(1);
    expect(result.itemBreakdown[0]).toMatchObject({
      menuId: "menu-1",
      quantity: 2,
      unitPrice: 9000,
    });
    expect(result.itemBreakdown[0]?.menuCostSnapshot.toString()).toBe("4820");
  });

  it("빈 입력은 0 / 0 / 0 / rate 0", () => {
    const result = computeSnapshotPreview([], [palbingsu]);
    expect(result.totalRevenue.toString()).toBe("0");
    expect(result.totalCost.toString()).toBe("0");
    expect(result.marginRate.toString()).toBe("0");
  });

  it("결과는 모두 Decimal 타입 (정밀도 보존)", () => {
    const items: SaleItemInput[] = [{ menuId: "menu-1", quantity: 1 }];
    const result = computeSnapshotPreview(items, [palbingsu]);
    expect(result.totalRevenue).toBeInstanceOf(Decimal);
    expect(result.totalCost).toBeInstanceOf(Decimal);
    expect(result.totalNetProfit).toBeInstanceOf(Decimal);
    expect(result.marginRate).toBeInstanceOf(Decimal);
  });

  it("알 수 없는 menuId는 throw — Edge Case 차단 (FR-006 전제)", () => {
    expect(() => computeSnapshotPreview([{ menuId: "ghost", quantity: 1 }], [palbingsu])).toThrow(
      /menu not found/,
    );
  });

  it("음수 수량은 throw", () => {
    expect(() =>
      computeSnapshotPreview([{ menuId: "menu-1", quantity: -1 }], [palbingsu]),
    ).toThrow();
  });

  it("0 수량은 throw — 0개 판매는 의미 없음, 호출 측이 사전 필터링해야", () => {
    expect(() =>
      computeSnapshotPreview([{ menuId: "menu-1", quantity: 0 }], [palbingsu]),
    ).toThrow();
  });
});

describe("isSaleLocked / daysUntilLock (FR-030)", () => {
  const now = new Date("2026-04-30T12:00:00");

  it("created_at 6일 23시간 59분 전: lock 안 됨", () => {
    const created = new Date("2026-04-23T12:00:01");
    expect(isSaleLocked(created, now)).toBe(false);
  });

  it("created_at 7일 정확히: lock 안 됨 (경계 포함)", () => {
    const created = new Date("2026-04-23T12:00:00");
    expect(isSaleLocked(created, now)).toBe(false);
  });

  it("created_at 7일 1초 초과: lock", () => {
    const created = new Date("2026-04-23T11:59:59");
    expect(isSaleLocked(created, now)).toBe(true);
  });

  it("daysUntilLock: 방금 만든 sale은 7일", () => {
    expect(daysUntilLock(now, now)).toBe(7);
  });

  it("daysUntilLock: 3일 전 sale은 4일 남음", () => {
    const created = new Date("2026-04-27T12:00:00");
    expect(daysUntilLock(created, now)).toBe(4);
  });

  it("daysUntilLock: 7일 초과는 0", () => {
    const created = new Date("2026-04-22T12:00:00");
    expect(daysUntilLock(created, now)).toBe(0);
  });
});
