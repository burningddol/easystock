import { z } from "zod";

/**
 * 판매 도메인 입력 스키마. RPC / API 경계에서 검증.
 * contracts/domain-rpc.md L61~130.
 */

export const saleItemInputSchema = z.object({
  menuId: z.string().uuid(),
  quantity: z.number().int().positive(),
  options: z
    .array(
      z.object({
        optionValueId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .optional(),
});

export type SaleItemInputDto = z.infer<typeof saleItemInputSchema>;

export const saveSaleSchema = z.object({
  soldAt: z.string().date(),
  items: z.array(saleItemInputSchema).min(1, "최소 1개 메뉴를 입력해주세요"),
});

export type SaveSaleInput = z.infer<typeof saveSaleSchema>;

export const editSaleSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().max(200).optional(),
  newItems: z.array(saleItemInputSchema).min(1),
});

export type EditSaleInput = z.infer<typeof editSaleSchema>;

export const deleteSaleSchema = z.object({
  saleId: z.string().uuid(),
});

export type DeleteSaleInput = z.infer<typeof deleteSaleSchema>;
