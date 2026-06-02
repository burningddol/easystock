import { savePurchase, type SavePurchaseResult } from "@/lib/supabase/rpc";

interface RpcClient {
  rpc: unknown;
}

export interface SubmitPurchaseItemInput {
  ingredientId: string;
  quantity: number;
  amount: number;
}

export interface SubmitPurchaseInput {
  vendorId: string;
  purchasedAt: string;
  items: ReadonlyArray<SubmitPurchaseItemInput>;
}

export async function submitPurchase(
  client: RpcClient,
  input: SubmitPurchaseInput,
): Promise<SavePurchaseResult> {
  const { data, error } = await savePurchase(client, {
    vendorId: input.vendorId,
    purchasedAt: input.purchasedAt,
    items: input.items,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("save_purchase: empty response");
  return data;
}
