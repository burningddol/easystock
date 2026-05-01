import { Decimal } from "./_decimal";
import { assertNonNegative } from "./_assert";

/**
 * 헌법 III (NON-NEGOTIABLE): 가중 이동 평균법으로 재료 단가 산정.
 *
 *   new_avg = (current_stock × current_avg + new_qty × new_unit_price)
 *           / (current_stock + new_qty)
 *
 * - 첫 매입(current_stock = 0): new_avg = new_unit_price (FR-004)
 * - new_quantity = 0: current_avg 유지 (no-op 매입 방어)
 *
 * 결과는 Decimal — numeric(12,4) DB 컬럼에는 `.toFixed(4)`로 저장.
 */

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
  assertNonNegative(currentStock, "currentStock");
  assertNonNegative(currentAvg, "currentAvg");
  assertNonNegative(newQuantity, "newQuantity");
  assertNonNegative(newUnitPrice, "newUnitPrice");

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
