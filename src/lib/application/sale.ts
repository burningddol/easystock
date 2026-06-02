import {
  deleteSale as deleteSaleRpc,
  editSale as editSaleRpc,
  saveSale as saveSaleRpc,
} from "@/lib/supabase/rpc";

interface RpcClient {
  rpc: unknown;
}

export interface SubmitSaleItemInput {
  menuId: string;
  quantity: number;
}

export interface SubmitSaleInput {
  soldAt: string;
  items: ReadonlyArray<SubmitSaleItemInput>;
}

export interface SubmitSaleResult {
  saleId: string;
  totalRevenue: number;
  totalCostSnapshot: number;
  totalNetProfit: number;
  marginPercent: number;
}

export interface EditSaleInput {
  saleId: string;
  newItems: ReadonlyArray<SubmitSaleItemInput>;
  reason?: string;
}

export interface EditSaleResult {
  totalRevenue: number;
  totalCostSnapshot: number;
}

interface SaleRpcRow {
  sale_id: string;
  total_revenue: number;
  total_cost_snapshot: number;
  total_net_profit: number;
  margin_percent: number;
}

function mapSaleRow(row: SaleRpcRow): SubmitSaleResult {
  return {
    saleId: row.sale_id,
    totalRevenue: Number(row.total_revenue),
    totalCostSnapshot: Number(row.total_cost_snapshot),
    totalNetProfit: Number(row.total_net_profit),
    marginPercent: Number(row.margin_percent),
  };
}

function mapEditRow(row: SaleRpcRow): EditSaleResult {
  return {
    totalRevenue: Number(row.total_revenue),
    totalCostSnapshot: Number(row.total_cost_snapshot),
  };
}

export async function submitSale(
  client: RpcClient,
  input: SubmitSaleInput,
): Promise<SubmitSaleResult> {
  const { data, error } = await saveSaleRpc(client, {
    soldAt: input.soldAt,
    items: input.items,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("save_sale: no row returned");
  return mapSaleRow(row);
}

export async function editSale(client: RpcClient, input: EditSaleInput): Promise<EditSaleResult> {
  const { data, error } = await editSaleRpc(client, {
    saleId: input.saleId,
    newItems: input.newItems,
    reason: input.reason,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("edit_sale: no row");
  return mapEditRow(row);
}

export async function removeSale(client: RpcClient, saleId: string): Promise<void> {
  const { error } = await deleteSaleRpc(client, saleId);
  if (error) throw new Error(error.message);
}
