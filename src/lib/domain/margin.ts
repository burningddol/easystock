import { Decimal } from "./_decimal";
import { assertNonNegative } from "./_assert";

/**
 * 헌법 III: 메뉴 원가 / 마진 산정.
 *
 * - 메뉴 원가 = Σ(레시피 항목.quantity × 재료.avgPrice)
 * - 마진 금액 = 메뉴 가격 - 메뉴 원가
 * - 마진율 = 마진 금액 / 메뉴 가격 × 100
 *
 * UI 표기는 항상 `MARGIN_LABEL` 동봉 (재료 원가 기준 이동평균법) — 임대료·인건비 미포함.
 */

export const MARGIN_LABEL = "재료 원가 기준 (이동평균법)" as const;
export type MarginLabel = typeof MARGIN_LABEL;

export interface RecipeItemForCost {
  quantity: number;
  avgPrice: number;
}

export function calculateMenuCost(recipe: readonly RecipeItemForCost[]): Decimal {
  return recipe.reduce((total, item) => {
    assertNonNegative(item.quantity, "recipe item quantity");
    assertNonNegative(item.avgPrice, "recipe item avgPrice");
    return total.plus(new Decimal(item.quantity).times(item.avgPrice));
  }, new Decimal(0));
}

export interface MarginInput {
  price: number;
  cost: number | Decimal;
}

export interface MarginResult {
  amount: Decimal;
  rate: Decimal;
  label: MarginLabel;
}

export function calculateMargin({ price, cost }: MarginInput): MarginResult {
  assertNonNegative(price, "menu price");

  const costDecimal = cost instanceof Decimal ? cost : new Decimal(cost);

  if (price === 0) {
    return { amount: costDecimal.negated(), rate: new Decimal(0), label: MARGIN_LABEL };
  }

  const priceDecimal = new Decimal(price);
  const amount = priceDecimal.minus(costDecimal);
  const rate = amount.dividedBy(priceDecimal).times(100);

  return { amount, rate, label: MARGIN_LABEL };
}
