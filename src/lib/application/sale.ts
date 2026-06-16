import {
  applySaleSnapshotRewrite as applySaleSnapshotRewriteRpc,
  deleteSale as deleteSaleRpc,
  editSale as editSaleRpc,
  saveSale as saveSaleRpc,
} from "@/lib/supabase/rpc";

export interface SaleClient {
  rpc: unknown;
  from?: (table: string) => {
    select: (query: string) => {
      eq: (
        column: string,
        value: unknown,
      ) => {
        maybeSingle: () => PromiseLike<{
          data: IngredientErrorRow | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export interface SubmitSaleItemInput {
  menuId: string;
  quantity: number;
  options?: ReadonlyArray<{
    optionValueId: string;
    quantity: number;
  }>;
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

interface IngredientErrorRow {
  name: string;
  unit: string;
  current_stock: string | number;
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
  client: SaleClient,
  input: SubmitSaleInput,
): Promise<SubmitSaleResult> {
  const { data, error } = await saveSaleRpc(client, {
    soldAt: input.soldAt,
    items: input.items,
  });
  if (error) throw new Error(await toSaleErrorMessage(client, error.message));
  const row = data?.[0];
  if (!row) throw new Error("save_sale: no row returned");
  return mapSaleRow(row);
}

export async function editSale(client: SaleClient, input: EditSaleInput): Promise<EditSaleResult> {
  const { data, error } = await editSaleRpc(client, {
    saleId: input.saleId,
    newItems: input.newItems,
    reason: input.reason,
  });
  if (error) throw new Error(await toSaleErrorMessage(client, error.message));
  const row = data?.[0];
  if (!row) throw new Error("edit_sale: no row");
  return mapEditRow(row);
}

export async function removeSale(client: SaleClient, saleId: string): Promise<void> {
  const { error } = await deleteSaleRpc(client, saleId);
  if (error) throw new Error(toBasicSaleErrorMessage(error.message));
}

export interface ApplySaleSnapshotRewriteInput {
  fromDate: string;
  note?: string;
}

export interface ApplySaleSnapshotRewriteResult {
  replayRunId: string;
  affectedSaleCount: number;
  affectedItemCount: number;
  totalCostDelta: number;
}

export async function applySaleSnapshotRewrite(
  client: SaleClient,
  input: ApplySaleSnapshotRewriteInput,
): Promise<ApplySaleSnapshotRewriteResult> {
  const { data, error } = await applySaleSnapshotRewriteRpc(client, {
    fromDate: input.fromDate,
    note: input.note,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("apply_sale_snapshot_rewrite: no row returned");
  return data;
}

export function formatSaleErrorMessage(message: string): string {
  return toBasicSaleErrorMessage(message);
}

async function toSaleErrorMessage(client: SaleClient, message: string): Promise<string> {
  const ingredientId = parseNegativeStockIngredientId(message);
  if (!ingredientId) return toBasicSaleErrorMessage(message);

  const ingredient = await loadIngredientForError(client, ingredientId);
  if (!ingredient) {
    return "재료 재고가 부족해서 저장할 수 없어요. 먼저 매입 또는 재고실사로 재고를 채운 뒤 다시 저장해주세요.";
  }

  const stock = Number(ingredient.current_stock);
  const stockLabel = Number.isFinite(stock) ? `${formatStock(stock)}${ingredient.unit}` : "부족";
  return `${ingredient.name} 재고가 부족해요. 현재 재고는 ${stockLabel}입니다. 먼저 매입 또는 재고실사로 재고를 채운 뒤 다시 저장해주세요.`;
}

function toBasicSaleErrorMessage(message: string): string {
  if (message.includes("duplicate_sale")) {
    return "이미 이 날짜의 판매가 입력되어 있어요. 캘린더 날짜 상세 또는 판매 수정 화면에서 기존 기록을 수정해주세요.";
  }
  if (message.includes("sale_locked")) {
    return "저장 후 7일이 지나 수정할 수 없는 판매 기록이에요.";
  }
  if (message.includes("menu_inactive")) {
    return "비활성화된 메뉴가 포함되어 있어 저장할 수 없어요.";
  }
  if (message.includes("menu_no_recipe")) {
    return "레시피가 없는 메뉴가 포함되어 있어 저장할 수 없어요.";
  }
  if (message.includes("menu not found")) {
    return "메뉴를 다시 불러오지 못했어요. 새로고침 후 다시 시도해주세요.";
  }
  if (
    message.includes("Could not find a relationship between 'menus' and 'menu_option_groups'") ||
    message.includes("Could not find the table 'public.menu_option_groups' in the schema cache")
  ) {
    return "메뉴 옵션 데이터를 아직 불러오지 못했어요. 데이터베이스 마이그레이션 반영 후 다시 시도해주세요.";
  }
  if (message.includes("failed to parse select parameter")) {
    return "메뉴 데이터를 읽는 중 오류가 발생했어요. 최신 마이그레이션 반영 후 다시 시도해주세요.";
  }
  if (message.includes("duplicate key value violates unique constraint")) {
    return "이미 같은 내용이 저장되어 있어요. 입력 값을 다시 확인해주세요.";
  }
  if (message.includes("permission denied")) {
    return "권한 문제로 저장할 수 없어요. 로그인 상태와 접근 권한을 확인해주세요.";
  }
  return message;
}

function parseNegativeStockIngredientId(message: string): string | null {
  const match = /negative_stock:\s*ingredient_id=([0-9a-f-]+)/i.exec(message);
  return match?.[1] ?? null;
}

async function loadIngredientForError(
  client: SaleClient,
  ingredientId: string,
): Promise<IngredientErrorRow | null> {
  if (!client.from) return null;
  const { data, error } = await client
    .from("ingredients")
    .select("name, unit, current_stock")
    .eq("id", ingredientId)
    .maybeSingle();
  if (error) return null;
  return data;
}

function formatStock(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("ko-KR") : value.toLocaleString("ko-KR");
}
