import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/domain/_decimal";
import {
  calculateMenuCost,
  calculateMargin,
  MARGIN_LABEL,
  type RecipeItemForCost,
} from "@/lib/domain/margin";

/**
 * 헌법 III: 메뉴 원가/마진은 항상 "재료 원가 기준 (이동평균법)" 라벨과 함께 표시.
 * 임대료·인건비 절대 포함하지 않음.
 *
 * 메뉴 원가 = sum(quantity × ingredient.current_avg_price)
 * 마진 금액 = price - cost
 * 마진율 = (price - cost) / price × 100
 */

describe("calculateMenuCost", () => {
  it("단일 재료: 우유 200ml @ 5원/ml = 1000원", () => {
    const recipe: RecipeItemForCost[] = [{ quantity: 200, avgPrice: 5 }];
    const result = calculateMenuCost(recipe);
    expect(result.toString()).toBe("1000");
  });

  it("복수 재료 합산", () => {
    const recipe: RecipeItemForCost[] = [
      { quantity: 200, avgPrice: 5 }, // 1000
      { quantity: 150, avgPrice: 8 }, // 1200
      { quantity: 1, avgPrice: 500 }, // 500
    ];
    const result = calculateMenuCost(recipe);
    expect(result.toString()).toBe("2700");
  });

  it("빈 레시피는 0원", () => {
    expect(calculateMenuCost([]).toString()).toBe("0");
  });

  it("avgPrice = 0인 재료(가입 직후 상태)는 0원으로 합산 — 마진 100% 표시", () => {
    const recipe: RecipeItemForCost[] = [
      { quantity: 200, avgPrice: 0 },
      { quantity: 150, avgPrice: 0 },
    ];
    expect(calculateMenuCost(recipe).toString()).toBe("0");
  });

  it("부동소수점 누적 — Decimal로 정밀 계산", () => {
    const recipe: RecipeItemForCost[] = [
      { quantity: 0.1, avgPrice: 0.2 },
      { quantity: 0.1, avgPrice: 0.2 },
      { quantity: 0.1, avgPrice: 0.2 },
    ];
    // JS native: 0.1*0.2 + 0.1*0.2 + 0.1*0.2 = 0.06000000000000001
    // Decimal: 정확히 0.06
    expect(calculateMenuCost(recipe).toString()).toBe("0.06");
  });

  it("결과는 Decimal 타입", () => {
    const recipe: RecipeItemForCost[] = [{ quantity: 100, avgPrice: 10 }];
    expect(calculateMenuCost(recipe)).toBeInstanceOf(Decimal);
  });

  it("음수 수량/단가는 거부", () => {
    expect(() => calculateMenuCost([{ quantity: -1, avgPrice: 10 }])).toThrow();
    expect(() => calculateMenuCost([{ quantity: 1, avgPrice: -10 }])).toThrow();
  });
});

describe("calculateMargin", () => {
  it("매출 5000원 - 원가 2000원 = 마진 3000원, 60%", () => {
    const result = calculateMargin({ price: 5000, cost: new Decimal(2000) });
    expect(result.amount.toString()).toBe("3000");
    expect(result.rate.toString()).toBe("60");
  });

  it("원가가 매출보다 크면 음수 마진율", () => {
    const result = calculateMargin({ price: 1000, cost: new Decimal(1500) });
    expect(result.amount.toString()).toBe("-500");
    expect(result.rate.toString()).toBe("-50");
  });

  it("price = 0이면 rate는 0 (division by zero 방어)", () => {
    const result = calculateMargin({ price: 0, cost: new Decimal(0) });
    expect(result.rate.toString()).toBe("0");
  });

  it("cost = 0이면 마진율 100% (가입 직후 상태)", () => {
    const result = calculateMargin({ price: 5000, cost: new Decimal(0) });
    expect(result.rate.toString()).toBe("100");
  });

  it("라벨이 항상 MARGIN_LABEL 상수와 일치 — UI에서 import해 비교 가능", () => {
    const result = calculateMargin({ price: 5000, cost: new Decimal(2000) });
    expect(result.label).toBe(MARGIN_LABEL);
  });

  it("cost를 number로 넘겨도 Decimal로 normalize됨 — RPC 응답 직결 호출 호환", () => {
    const result = calculateMargin({ price: 5000, cost: 2000 });
    expect(result.amount.toString()).toBe("3000");
    expect(result.rate.toString()).toBe("60");
  });

  it("음수 가격은 거부", () => {
    expect(() => calculateMargin({ price: -100, cost: new Decimal(50) })).toThrow();
  });

  it("음수 원가는 거부 (price=0이어도 short-circuit으로 우회되지 않음)", () => {
    expect(() => calculateMargin({ price: 0, cost: new Decimal(-1) })).toThrow();
    expect(() => calculateMargin({ price: 5000, cost: new Decimal(-1) })).toThrow();
  });

  it("NaN 입력은 거부", () => {
    expect(() => calculateMargin({ price: Number.NaN, cost: new Decimal(0) })).toThrow(/NaN/);
    expect(() => calculateMargin({ price: 5000, cost: Number.NaN })).toThrow(/NaN/);
  });
});
