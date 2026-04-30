import Decimal from "decimal.js";

/**
 * 헌법 III: 메뉴 원가 / 마진 산정.
 *
 * - 메뉴 원가 = Σ(레시피 항목.수량 × 재료.current_avg_price)
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
    if (item.quantity < 0) {
      throw new Error(`recipe item quantity must be non-negative (got ${item.quantity})`);
    }
    if (item.avgPrice < 0) {
      throw new Error(`recipe item avgPrice must be non-negative (got ${item.avgPrice})`);
    }
    return total.plus(new Decimal(item.quantity).times(item.avgPrice));
  }, new Decimal(0));
}

export interface MarginInput {
  price: number;
  cost: Decimal;
}

export interface MarginResult {
  amount: Decimal;
  rate: Decimal;
  label: MarginLabel;
}

export function calculateMargin({ price, cost }: MarginInput): MarginResult {
  if (price < 0) {
    throw new Error(`menu price must be non-negative (got ${price})`);
  }

  const priceDecimal = new Decimal(price);
  const amount = priceDecimal.minus(cost);
  const rate = priceDecimal.isZero() ? new Decimal(0) : amount.dividedBy(priceDecimal).times(100);

  return { amount, rate, label: MARGIN_LABEL };
}
