import { Decimal } from "./_decimal";
import {
  calculateMargin,
  calculateMenuCost,
  MARGIN_LABEL,
  type MarginLabel,
  type RecipeItemForCost,
} from "./margin";

/**
 * 헌법 III: Sale 저장 시 메뉴 원가/판매가 스냅샷 영구 보존.
 *
 * 같은 함수가 두 곳에서 사용:
 * 1. 클라이언트 입력 폼 미리보기 (StickyTotalCard) — 실시간 매출/마진
 * 2. 서버 RPC `save_sale` 의 검증 — 저장 직전 같은 값 산출
 *    (RPC는 SQL로 동일 공식 구현, 이 함수는 타입 안전한 클라이언트 미러)
 *
 * 7일 lock(FR-030)도 같은 모듈에 묶음 — sale 도메인의 일관성 단위.
 */

const SALE_EDIT_WINDOW_DAYS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface MenuForSnapshot {
  id: string;
  name: string;
  price: number;
  recipeItems: readonly RecipeItemForCost[];
}

export interface SaleItemInput {
  menuId: string;
  quantity: number;
}

export interface SaleItemSnapshot {
  menuId: string;
  menuName: string;
  quantity: number;
  unitPrice: number;
  menuCostSnapshot: Decimal;
  lineRevenue: Decimal;
  lineCost: Decimal;
}

export interface SaleSnapshotPreview {
  totalRevenue: Decimal;
  totalCost: Decimal;
  totalNetProfit: Decimal;
  marginRate: Decimal;
  label: MarginLabel;
  itemBreakdown: SaleItemSnapshot[];
}

export function computeSnapshotPreview(
  items: readonly SaleItemInput[],
  menus: readonly MenuForSnapshot[],
): SaleSnapshotPreview {
  const menuById = new Map(menus.map((m) => [m.id, m]));
  const breakdown = items.map((item) => buildLineSnapshot(item, menuById));
  const totalRevenue = breakdown.reduce((sum, line) => sum.plus(line.lineRevenue), new Decimal(0));
  const totalCost = breakdown.reduce((sum, line) => sum.plus(line.lineCost), new Decimal(0));

  // Decimal 그대로 전달 — number round-trip 시 큰 카트에서 소수 손실.
  const margin = calculateMargin({ price: totalRevenue, cost: totalCost });

  return {
    totalRevenue,
    totalCost,
    totalNetProfit: margin.amount,
    marginRate: margin.rate,
    label: MARGIN_LABEL,
    itemBreakdown: breakdown,
  };
}

function buildLineSnapshot(
  item: SaleItemInput,
  menuById: ReadonlyMap<string, MenuForSnapshot>,
): SaleItemSnapshot {
  if (item.quantity <= 0) {
    throw new Error(`sale item quantity must be positive (got ${item.quantity})`);
  }

  const menu = menuById.get(item.menuId);
  if (!menu) {
    throw new Error(`menu not found: ${item.menuId}`);
  }

  const menuCostSnapshot = calculateMenuCost(menu.recipeItems);
  const qty = new Decimal(item.quantity);

  return {
    menuId: menu.id,
    menuName: menu.name,
    quantity: item.quantity,
    unitPrice: menu.price,
    menuCostSnapshot,
    lineRevenue: qty.times(menu.price),
    lineCost: qty.times(menuCostSnapshot),
  };
}

/**
 * FR-030: 7일 초과 sale은 편집/삭제 잠금.
 * 경계 정책: 정확히 7일은 잠금되지 않음 (사용자에게 7일 보장).
 */
export function isSaleLocked(saleCreatedAt: Date, now: Date = new Date()): boolean {
  const elapsedMs = now.getTime() - saleCreatedAt.getTime();
  return elapsedMs > SALE_EDIT_WINDOW_DAYS * ONE_DAY_MS;
}

export function daysUntilLock(saleCreatedAt: Date, now: Date = new Date()): number {
  const elapsedMs = now.getTime() - saleCreatedAt.getTime();
  const remainingMs = SALE_EDIT_WINDOW_DAYS * ONE_DAY_MS - elapsedMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / ONE_DAY_MS);
}
