import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeNewWeightedAverage } from "@/lib/domain/pricing";

/**
 * 헌법 III (NON-NEGOTIABLE): 가중 이동 평균법.
 *
 * new_avg = (current_stock × current_avg + qty × unit_price) / (current_stock + qty)
 *
 * 첫 매입(current_stock = 0)이면 new_avg = unit_price (FR-004).
 * 누적 정밀도: numeric(12,4) 컬럼과 일관, 30일 누적 ≤ 0.01원 오차 (SC-009).
 */

describe("computeNewWeightedAverage", () => {
  describe("첫 매입 (current_stock = 0)", () => {
    it("새 평균 단가는 단위 가격과 같다", () => {
      const result = computeNewWeightedAverage({
        currentStock: 0,
        currentAvg: 0,
        newQuantity: 1000,
        newUnitPrice: 50,
      });
      expect(result.toString()).toBe("50");
    });

    it("currentAvg가 0이 아니어도 stock이 0이면 새 단가만 반영", () => {
      const result = computeNewWeightedAverage({
        currentStock: 0,
        currentAvg: 100, // 이전 데이터, 무시되어야 함
        newQuantity: 500,
        newUnitPrice: 80,
      });
      expect(result.toString()).toBe("80");
    });
  });

  describe("일반 매입", () => {
    it("재고 1000g @ 50원 + 1000g @ 70원 = 60원", () => {
      const result = computeNewWeightedAverage({
        currentStock: 1000,
        currentAvg: 50,
        newQuantity: 1000,
        newUnitPrice: 70,
      });
      expect(result.toString()).toBe("60");
    });

    it("재고 차이 큼: 9000g @ 50원 + 1000g @ 100원 = 55원", () => {
      const result = computeNewWeightedAverage({
        currentStock: 9000,
        currentAvg: 50,
        newQuantity: 1000,
        newUnitPrice: 100,
      });
      expect(result.toString()).toBe("55");
    });

    it("결과는 Decimal 타입 (부동소수점 오차 방지)", () => {
      const result = computeNewWeightedAverage({
        currentStock: 333,
        currentAvg: 33.33,
        newQuantity: 100,
        newUnitPrice: 99.99,
      });
      expect(result).toBeInstanceOf(Decimal);
    });
  });

  describe("정밀도 (SC-009)", () => {
    it("30일 누적 시 오차 ≤ 0.01원", () => {
      // 시나리오: 매일 100g씩, 단가 1.111원 ~ 1.999원 사이 변동.
      const purchases = [
        1.111, 1.234, 1.567, 1.789, 1.234, 1.456, 1.678, 1.999, 1.111, 1.345, 1.567, 1.789, 1.234,
        1.456, 1.678, 1.999, 1.111, 1.345, 1.567, 1.789, 1.234, 1.456, 1.678, 1.999, 1.111, 1.345,
        1.567, 1.789, 1.234, 1.456,
      ];

      let stock = 0;
      let avg = new Decimal(0);
      for (const unitPrice of purchases) {
        avg = computeNewWeightedAverage({
          currentStock: stock,
          currentAvg: Number(avg),
          newQuantity: 100,
          newUnitPrice: unitPrice,
        });
        stock += 100;
      }

      // 정확한 가중 평균 = sum(qty × price) / sum(qty)
      const totalCost = purchases.reduce(
        (sum, p) => sum.plus(new Decimal(100).times(p)),
        new Decimal(0),
      );
      const totalQty = purchases.length * 100;
      const exactAvg = totalCost.dividedBy(totalQty);

      expect(avg.minus(exactAvg).abs().toNumber()).toBeLessThanOrEqual(0.01);
    });

    it("소수 4자리 numeric(12,4) DB 컬럼 호환", () => {
      const result = computeNewWeightedAverage({
        currentStock: 7,
        currentAvg: 3,
        newQuantity: 3,
        newUnitPrice: 11,
      });
      // (7×3 + 3×11) / 10 = (21 + 33) / 10 = 5.4
      expect(result.toFixed(4)).toBe("5.4000");
    });
  });

  describe("edge cases", () => {
    it("newQuantity = 0이면 currentAvg 유지", () => {
      const result = computeNewWeightedAverage({
        currentStock: 1000,
        currentAvg: 50,
        newQuantity: 0,
        newUnitPrice: 999,
      });
      expect(result.toString()).toBe("50");
    });

    it("음수 수량은 거부", () => {
      expect(() =>
        computeNewWeightedAverage({
          currentStock: 1000,
          currentAvg: 50,
          newQuantity: -100,
          newUnitPrice: 70,
        }),
      ).toThrow();
    });

    it("음수 단가는 거부", () => {
      expect(() =>
        computeNewWeightedAverage({
          currentStock: 1000,
          currentAvg: 50,
          newQuantity: 100,
          newUnitPrice: -10,
        }),
      ).toThrow();
    });
  });
});
