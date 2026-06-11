"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMenus, type MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";
import { EMPTY_SALE_DRAFT_ITEMS, sanitizeSaleDraftItems, useSaleDraft } from "@/stores/sale-draft";
import { computeSnapshotPreview } from "@/lib/domain/snapshot";
import { localIsoDate } from "@/lib/utils/format";
import { PrimaryButton } from "@/components/ui/primary-button";
import { MenuRow } from "./MenuRow";
import { StickyTotalCard } from "./StickyTotalCard";
import { SaleSaveBar } from "./SaleSaveBar";
import { useSaleSubmit } from "../hooks/useSaleSubmit";
import { useFavoriteMenus } from "../hooks/useFavoriteMenus";
import { findSaleStockShortages, formatStockShortageMessage } from "../lib/stock-guard";
import { toSnapshotMenu } from "../lib/to-snapshot-menu";

interface SaleInputFormProps {
  soldAt: string; // YYYY-MM-DD
  isFirstSale: boolean;
}

export function SaleInputForm({ soldAt, isFirstSale }: SaleInputFormProps): React.ReactElement {
  const router = useRouter();
  const { data: menus } = useMenus();
  const { data: favorites } = useFavoriteMenus();
  const draftItems = useSaleDraft((s) => s.draftsByDate[soldAt] ?? EMPTY_SALE_DRAFT_ITEMS);
  const setQuantity = useSaleDraft((s) => s.setQuantity);
  const clearDraftDate = useSaleDraft((s) => s.clearDate);
  const replaceDraftItems = useSaleDraft((s) => s.replaceDateItems);
  const submit = useSaleSubmit();

  useEffect(() => {
    if (!menus) return;

    const validMenuIds = new Set(menus.map((menu) => menu.id));
    const filtered = draftItems.filter((item) => validMenuIds.has(item.menuId));

    if (filtered.length !== draftItems.length) {
      replaceDraftItems(soldAt, filtered);
    }
  }, [draftItems, menus, replaceDraftItems, soldAt]);

  // ~20개 메뉴 sort + Map 구성은 trivial, useMemo 오버헤드만 더함 → inline.
  const sortedMenus = sortByFavorites(menus ?? [], favorites ?? []);
  const validMenuIds = menus ? new Set(menus.map((menu) => menu.id)) : null;
  const items = validMenuIds ? sanitizeSaleDraftItems(draftItems, validMenuIds) : draftItems;
  const draftMap = new Map(items.map((it) => [it.menuId, it.quantity]));

  const preview =
    menus && menus.length > 0
      ? computeSnapshotPreview(
          items.filter((it) => it.quantity > 0),
          menus.map(toSnapshotMenu),
        )
      : null;
  const shortages = menus && menus.length > 0 ? findSaleStockShortages({ items, menus }) : [];
  const stockGuardMessage = formatStockShortageMessage(shortages);

  function handleSubmit(): void {
    if (shortages.length > 0) return;

    submit.mutate(
      {
        soldAt,
        items: items.filter((it) => it.quantity > 0),
        isFirstSale,
      },
      {
        onSuccess: () => {
          clearDraftDate(soldAt);
          router.push("/today");
        },
      },
    );
  }

  if (!menus) {
    return (
      <p className="glow-panel rounded-[28px] border border-white/70 bg-white/92 px-5 py-4 text-body-regular text-ink-3 shadow-soft">
        메뉴를 불러오는 중…
      </p>
    );
  }
  if (menus.length === 0) {
    return (
      <p className="glow-panel rounded-[28px] border border-white/70 bg-white/92 px-5 py-4 text-body-regular text-ink-3 shadow-soft">
        먼저 메뉴를 등록해주세요. (메뉴 탭 → 템플릿 불러오기)
      </p>
    );
  }

  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);
  const isRetroactive = soldAt < localIsoDate();
  const isBlockedByStock = shortages.length > 0;

  return (
    <div className="flex flex-col gap-stack pb-36">
      {isRetroactive && (
        <p className="glow-panel rounded-[24px] border border-brand-primary/10 bg-brand-primary/[0.07] px-4 py-3 text-caption text-ink-3 shadow-soft">
          과거 날짜 판매를 저장하면 이 날짜 이후 7일 범위의 재고와 원가 스냅샷이 다시 계산됩니다.
        </p>
      )}

      <ul className="flex flex-col gap-stack-tight">
        {sortedMenus.map((menu) => (
          <MenuRow
            key={menu.id}
            menu={menu}
            quantity={draftMap.get(menu.id) ?? 0}
            onChange={(next) => setQuantity(soldAt, menu.id, next)}
          />
        ))}
      </ul>

      {preview && totalQuantity > 0 && <StickyTotalCard preview={preview} />}

      <SaleSaveBar
        left={
          (stockGuardMessage || submit.isError) && (
            <p
              role="alert"
              className="flex-1 whitespace-pre-line rounded-2xl bg-rose-50 px-3 py-2 text-caption text-rose-700"
            >
              {stockGuardMessage || submit.error?.message}
            </p>
          )
        }
        right={
          <PrimaryButton
            type="button"
            onClick={handleSubmit}
            disabled={totalQuantity === 0 || submit.isPending || isBlockedByStock}
            className="halo-cta"
          >
            {submit.isPending ? "저장 중…" : `${totalQuantity}개 저장`}
          </PrimaryButton>
        }
      />
    </div>
  );
}

function sortByFavorites(
  menus: readonly MenuRowWithRecipe[],
  favoriteIds: readonly string[],
): MenuRowWithRecipe[] {
  if (favoriteIds.length === 0) return [...menus];
  const order = new Map(favoriteIds.map((id, idx) => [id, idx]));
  const FALLBACK = favoriteIds.length + 1;
  return [...menus].sort((a, b) => (order.get(a.id) ?? FALLBACK) - (order.get(b.id) ?? FALLBACK));
}
