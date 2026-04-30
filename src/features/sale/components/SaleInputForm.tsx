"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMenus, type MenuRowWithRecipe } from "@/features/menu/hooks/useMenus";
import { useSaleDraft } from "@/stores/sale-draft";
import { computeSnapshotPreview } from "@/lib/domain/snapshot";
import { PrimaryButton } from "@/components/ui/primary-button";
import { MenuRow } from "./MenuRow";
import { StickyTotalCard } from "./StickyTotalCard";
import { SaleSaveBar } from "./SaleSaveBar";
import { useSaleSubmit } from "../hooks/useSaleSubmit";
import { useFavoriteMenus } from "../hooks/useFavoriteMenus";
import { toSnapshotMenu } from "../lib/to-snapshot-menu";

interface SaleInputFormProps {
  soldAt: string; // YYYY-MM-DD
  isFirstSale: boolean;
}

export function SaleInputForm({ soldAt, isFirstSale }: SaleInputFormProps): React.ReactElement {
  const router = useRouter();
  const { data: menus } = useMenus();
  const { data: favorites } = useFavoriteMenus();
  const draft = useSaleDraft();
  const submit = useSaleSubmit();

  // 페이지 진입 시 draft에 날짜 묶기 — soldAt 바뀌면 갱신.
  useEffect(() => {
    if (draft.draftDate !== soldAt) {
      draft.setDraftDate(soldAt);
    }
  }, [soldAt, draft]);

  const sortedMenus = useMemo(
    () => sortByFavorites(menus ?? [], favorites ?? []),
    [menus, favorites],
  );

  const draftMap = useMemo(
    () => new Map(draft.items.map((it) => [it.menuId, it.quantity])),
    [draft.items],
  );

  const preview = useMemo(() => {
    if (!menus || menus.length === 0) return null;
    return computeSnapshotPreview(
      draft.items.filter((it) => it.quantity > 0),
      menus.map(toSnapshotMenu),
    );
  }, [draft.items, menus]);

  function handleSubmit(): void {
    submit.mutate(
      {
        soldAt,
        items: draft.items.filter((it) => it.quantity > 0),
        isFirstSale,
      },
      {
        onSuccess: () => {
          draft.clear();
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

  const totalQuantity = draft.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <div className="flex flex-col gap-stack pb-44">
      <ul className="flex flex-col gap-stack-tight">
        {sortedMenus.map((menu) => (
          <MenuRow
            key={menu.id}
            menu={menu}
            quantity={draftMap.get(menu.id) ?? 0}
            onChange={(next) => draft.setQuantity(menu.id, next)}
          />
        ))}
      </ul>

      {preview && totalQuantity > 0 && <StickyTotalCard preview={preview} />}

      <SaleSaveBar
        left={
          submit.isError && (
            <p role="alert" className="flex-1 text-caption text-red">
              {submit.error.message}
            </p>
          )
        }
        right={
          <PrimaryButton
            type="button"
            onClick={handleSubmit}
            disabled={totalQuantity === 0 || submit.isPending}
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
