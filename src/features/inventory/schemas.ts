import { z } from "zod";

/**
 * 재고 실사 입력 스키마. RPC `apply_stock_count` 경계 검증.
 */

export const stockCountItemInputSchema = z.object({
  ingredientId: z.string().uuid(),
  actualStock: z.number().nonnegative("실재고는 0 이상이어야 합니다"),
});

export type StockCountItemInput = z.infer<typeof stockCountItemInputSchema>;

export const applyStockCountSchema = z.object({
  countedAt: z.string().date(),
  items: z.array(stockCountItemInputSchema).min(1, "최소 1개 재료를 입력해주세요"),
});

export type ApplyStockCountInput = z.infer<typeof applyStockCountSchema>;
