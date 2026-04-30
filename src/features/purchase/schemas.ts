import { z } from "zod";

/**
 * 매입 도메인 입력 스키마. RPC / API 경계에서 검증.
 * contracts/domain-rpc.md L15-55.
 */

export const purchaseItemInputSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive("수량은 0보다 커야 합니다"),
  amount: z.number().nonnegative("금액은 0 이상이어야 합니다"),
});

export type PurchaseItemInput = z.infer<typeof purchaseItemInputSchema>;

export const savePurchaseSchema = z.object({
  vendorId: z.string().uuid(),
  purchasedAt: z.string().date(),
  items: z.array(purchaseItemInputSchema).min(1, "최소 1개 항목을 입력해주세요"),
});

export type SavePurchaseInput = z.infer<typeof savePurchaseSchema>;

export const vendorInputSchema = z.object({
  name: z.string().min(1, "거래처 이름을 입력해주세요").max(50, "50자 이내"),
  leadTimeDays: z.number().int().nonnegative("리드타임은 0일 이상").default(1),
});

export type VendorInput = z.infer<typeof vendorInputSchema>;

export const ingredientInputSchema = z.object({
  name: z.string().min(1, "재료 이름을 입력해주세요").max(50, "50자 이내"),
  unit: z.enum(["g", "ml", "piece"]),
});

export type IngredientInput = z.infer<typeof ingredientInputSchema>;
