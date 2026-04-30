import Decimal from "decimal.js";

/**
 * 헌법 III (NON-NEGOTIABLE): 가중 이동 평균법으로 재료 단가 산정.
 *
 *   new_avg = (current_stock × current_avg + new_qty × new_unit_price)
 *           / (current_stock + new_qty)
 *
 * - 첫 매입(current_stock = 0): new_avg = new_unit_price (FR-004)
 * - new_quantity = 0: current_avg 유지 (no-op 매입은 호출 측에서 막아야 하지만 방어)
 *
 * Decimal.js로 부동소수점 누적 오차 차단. 결과는 numeric(12,4) DB 컬럼에
 * `.toFixed(4)`로 저장.
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface WeightedAverageInput {
  currentStock: number;
  currentAvg: number;
  newQuantity: number;
  newUnitPrice: number;
}

export function computeNewWeightedAverage({
  currentStock,
  currentAvg,
  newQuantity,
  newUnitPrice,
}: WeightedAverageInput): Decimal {
  if (newQuantity < 0) {
    throw new Error(`newQuantity must be non-negative (got ${newQuantity})`);
  }
  if (newUnitPrice < 0) {
    throw new Error(`newUnitPrice must be non-negative (got ${newUnitPrice})`);
  }

  if (newQuantity === 0) {
    return new Decimal(currentAvg);
  }

  const newPrice = new Decimal(newUnitPrice);
  if (currentStock === 0) {
    return newPrice;
  }

  const stock = new Decimal(currentStock);
  const avg = new Decimal(currentAvg);
  const qty = new Decimal(newQuantity);

  return stock.times(avg).plus(qty.times(newPrice)).dividedBy(stock.plus(qty));
}
