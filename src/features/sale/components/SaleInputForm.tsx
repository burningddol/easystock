"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMenus, type MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";
import { useSaleDraft } from "@/stores/sale-draft";
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
  // Zustand selector를 슬라이스별로 분리 — 전체 store 구독 시 모든 mutation이 매 렌더 트리거.
  const items = useSaleDraft((s) => s.items);
  const draftDate = useSaleDraft((s) => s.draftDate);
  const setDraftDate = useSaleDraft((s) => s.setDraftDate);
  const setQuantity = useSaleDraft((s) => s.setQuantity);
  const clearDraft = useSaleDraft((s) => s.clear);
  const submit = useSaleSubmit();

  useEffect(() => {
    if (draftDate !== soldAt) {
      setDraftDate(soldAt);
    }
  }, [soldAt, draftDate, setDraftDate]);

  // ~20개 메뉴 sort + Map 구성은 trivial, useMemo 오버헤드만 더함 → inline.
  const sortedMenus = sortByFavorites(menus ?? [], favorites ?? []);
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
          clearDraft();
          router.push("/today");
        },
      },
    );
  }

  if (!menus) {
    return <p className="text-body-regular text-ink-3">메뉴를 불러오는 중…</p>;
  }
  if (menus.length === 0) {
    return (
      <p className="text-body-regular text-ink-3">
        먼저 메뉴를 등록해주세요. (메뉴 탭 → 템플릿 불러오기)
      </p>
    );
  }

  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);
  const isRetroactive = soldAt < localIsoDate();
  const isBlockedByStock = shortages.length > 0;

  return (
    <div className="flex flex-col gap-stack pb-44">
      {isRetroactive && (
        <p className="rounded-md bg-bg p-stack text-caption text-ink-3">
          과거 날짜 판매를 저장하면 이 날짜 이후 7일 범위의 재고와 원가 스냅샷이 다시 계산됩니다.
        </p>
      )}

      <ul className="flex flex-col gap-stack-tight">
        {sortedMenus.map((menu) => (
          <MenuRow
            key={menu.id}
            menu={menu}
            quantity={draftMap.get(menu.id) ?? 0}
            onChange={(next) => setQuantity(menu.id, next)}
          />
        ))}
      </ul>

      {preview && totalQuantity > 0 && <StickyTotalCard preview={preview} />}

      <SaleSaveBar
        left={
          (stockGuardMessage || submit.isError) && (
            <p role="alert" className="flex-1 whitespace-pre-line text-caption text-red">
              {stockGuardMessage || submit.error?.message}
            </p>
          )
        }
        right={
          <PrimaryButton
            type="button"
            onClick={handleSubmit}
            disabled={totalQuantity === 0 || submit.isPending || isBlockedByStock}
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
