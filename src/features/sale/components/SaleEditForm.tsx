"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMenus } from "@/features/menu/hooks/useMenus";
import { computeSnapshotPreview, daysUntilLock } from "@/lib/domain/snapshot";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { cn } from "@/lib/utils";
import { useSaleEdit, useSaleDelete } from "../hooks/useSaleEdit";
import { findSaleStockShortages, formatStockShortageMessage } from "../lib/stock-guard";
import { toSnapshotMenuWithOptions } from "../lib/to-snapshot-menu-with-options";
import type { SaleWithItems } from "../hooks/useSaleByDate";
import { MenuRow } from "./MenuRow";
import { StickyTotalCard } from "./StickyTotalCard";
import { SaleSaveBar } from "./SaleSaveBar";
import type { SaleDraftOptionItem } from "@/stores/sale-draft";
import { SaleErrorNotice } from "./SaleErrorNotice";
import { formatSaleErrorMessage } from "@/lib/application/sale";

interface SaleEditFormProps {
  sale: SaleWithItems;
  createdAt: Date;
}

export function SaleEditForm({ sale, createdAt }: SaleEditFormProps): React.ReactElement {
  const router = useRouter();
  const { data: menus } = useMenus();
  const editMutation = useSaleEdit();
  const deleteMutation = useSaleDelete();

  // lazy 초기화 — initialQuantities 변경 시 setQuantities로 명시 재설정 (현재는 마운트 1회).
  const [quantities, setQuantities] = useState<Map<string, number>>(
    () => new Map(sale.items.map((it) => [it.menu_id, it.quantity])),
  );
  const [optionSelections, setOptionSelections] = useState<Map<string, SaleDraftOptionItem[]>>(
    () =>
      new Map(
        sale.items.map((it) => [
          it.menu_id,
          it.options.map((option) => ({
            groupId: option.option_group_id,
            optionValueId: option.option_value_id,
            quantity: option.quantity,
          })),
        ]),
      ),
  );
  const [reason, setReason] = useState("");

  // quantities Map identity가 매번 새로워서 useMemo가 skip 못 함 → inline derive.
  const items = Array.from(quantities.entries())
    .filter(([, qty]) => qty > 0)
    .map(([menuId, quantity]) => {
      return {
        menuId,
        quantity,
        options: optionSelections.get(menuId) ?? [],
      };
    });
  const activeMenuIds = menus ? new Set(menus.map((menu) => menu.id)) : null;
  const menuById = new Map((menus ?? []).map((menu) => [menu.id, menu]));
  const editableItems = activeMenuIds
    ? items.filter((item) => activeMenuIds.has(item.menuId))
    : items;
  const missingSaleItems = activeMenuIds
    ? sale.items.filter((item) => !activeMenuIds.has(item.menu_id))
    : [];

  const preview =
    menus && menus.length > 0 && editableItems.length > 0
      ? computeSnapshotPreview(
          editableItems,
          editableItems.map((item) =>
            toSnapshotMenuWithOptions(
              menuById.get(item.menuId)!,
              item.quantity,
              item.options ?? [],
            ),
          ),
        )
      : null;
  const shortages =
    menus && menus.length > 0
      ? findSaleStockShortages({
          items: editableItems,
          menus,
          existingItems: sale.items.map((item) => ({
            menu_id: item.menu_id,
            quantity: item.quantity,
            options: item.options.map((option) => ({
              groupId: option.option_group_id,
              optionValueId: option.option_value_id,
              quantity: option.quantity,
            })),
          })),
        })
      : [];
  const stockGuardMessage = formatStockShortageMessage(shortages);

  function setQuantity(menuId: string, next: number): void {
    setQuantities((prev) => {
      const updated = new Map(prev);
      if (next <= 0) {
        updated.delete(menuId);
        setOptionSelections((prevOptions) => {
          const updatedOptions = new Map(prevOptions);
          updatedOptions.delete(menuId);
          return updatedOptions;
        });
      } else {
        updated.set(menuId, next);
      }
      return updated;
    });
  }

  function setOptionQuantity(
    menuId: string,
    groupId: string,
    optionValueId: string,
    quantity: number,
  ): void {
    setOptionSelections((prev) => {
      const updated = new Map(prev);
      const current = updated.get(menuId) ?? [];
      const nextOptions = current.filter(
        (opt) => opt.groupId !== groupId || opt.optionValueId !== optionValueId,
      );
      if (quantity > 0) {
        nextOptions.push({ groupId, optionValueId, quantity });
      }
      updated.set(menuId, nextOptions);
      return updated;
    });
  }

  function handleSave(): void {
    if (shortages.length > 0 || missingSaleItems.length > 0) return;

    editMutation.mutate(
      { saleId: sale.id, newItems: editableItems, reason: reason.trim() || undefined },
      { onSuccess: () => router.push("/today") },
    );
  }

  function handleDelete(): void {
    // TODO(design-system): AlertDialog 패턴 추가 시 교체.
    if (!confirm(`${sale.sold_at} 판매 기록을 삭제할까요? 재고는 자동 되돌립니다.`)) return;
    deleteMutation.mutate(sale.id, { onSuccess: () => router.push("/today") });
  }

  if (!menus) {
    return (
      <p className="glow-panel rounded-[28px] border border-white/70 bg-white/92 px-5 py-4 text-body-regular text-ink-3 shadow-soft">
        메뉴를 불러오는 중…
      </p>
    );
  }

  const totalQuantity = editableItems.reduce((sum, it) => sum + it.quantity, 0);
  const isPending = editMutation.isPending || deleteMutation.isPending;
  const isBlockedByStock = shortages.length > 0;
  const isBlockedByMissingMenus = missingSaleItems.length > 0;
  const missingMenuMessage =
    missingSaleItems.length > 0
      ? [
          "이 판매에는 지금 비활성화되었거나 삭제된 메뉴가 포함되어 있어 수정 저장을 진행할 수 없어요.",
          ...missingSaleItems.map(
            (item) => `- ${item.menu_name ?? "알 수 없는 메뉴"} ${item.quantity}개`,
          ),
          "메뉴를 다시 활성화한 뒤 수정하거나, 필요하면 이 판매 기록을 삭제 후 다시 입력해 주세요.",
        ].join("\n")
      : null;
  const saleErrorMessage =
    editMutation.error?.message || deleteMutation.error?.message
      ? formatSaleErrorMessage(editMutation.error?.message || deleteMutation.error?.message || "")
      : "";

  return (
    <div className="flex flex-col gap-stack pb-36">
      <DaysLeftHint daysLeft={daysUntilLock(createdAt)} />
      <CostBasisNotice />

      <ul className="flex flex-col gap-stack-tight">
        {menus.map((menu) => (
          <MenuRow
            key={menu.id}
            menu={menu}
            quantity={quantities.get(menu.id) ?? 0}
            onChange={(next) => setQuantity(menu.id, next)}
            optionSelections={optionSelections.get(menu.id) ?? []}
            onOptionChange={(groupId, optionValueId, next) =>
              setOptionQuantity(menu.id, groupId, optionValueId, next)
            }
          />
        ))}
      </ul>

      <Field label="수정 사유 (선택, 200자 이내)">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 200))}
          rows={2}
          className="min-h-24 rounded-[24px] border border-white bg-white px-4 py-3 text-body-regular text-ink-1 shadow-soft outline-none transition placeholder:text-ink-4 focus:border-brand-primary/30 focus:ring-4 focus:ring-brand-primary/10"
          placeholder="예: 손님 환불, 잘못 입력 등"
        />
      </Field>

      {(missingMenuMessage || stockGuardMessage || saleErrorMessage) && (
        <SaleErrorNotice
          title={missingMenuMessage ? "수정 불가" : stockGuardMessage ? "재고 부족" : "수정 실패"}
          message={missingMenuMessage ?? stockGuardMessage ?? saleErrorMessage}
        />
      )}

      {preview && totalQuantity > 0 && <StickyTotalCard preview={preview} />}

      <SaleSaveBar
        left={
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className={cn(
              "rounded-2xl border border-rose-200 bg-white px-4 py-3 text-body-regular font-medium text-rose-600 shadow-soft transition hover:-translate-y-0.5 hover:bg-rose-50",
              isPending && "opacity-50",
            )}
          >
            {deleteMutation.isPending ? "삭제 중…" : "삭제"}
          </button>
        }
        right={
          <PrimaryButton
            type="button"
            onClick={handleSave}
            disabled={
              totalQuantity === 0 || isPending || isBlockedByStock || isBlockedByMissingMenus
            }
            className="halo-cta"
          >
            {editMutation.isPending ? "저장 중…" : "수정 저장"}
          </PrimaryButton>
        }
      />
    </div>
  );
}

function CostBasisNotice(): React.ReactElement {
  return (
    <p className="glow-panel rounded-[24px] border border-brand-primary/10 bg-brand-primary/[0.07] px-4 py-3 text-caption text-ink-3 shadow-soft">
      수정 저장 후 이 날짜 이후 7일 범위의 재고와 원가 스냅샷이 다시 계산됩니다.
    </p>
  );
}

function DaysLeftHint({ daysLeft }: { daysLeft: number }): React.ReactElement {
  return (
    <p className={cn("rounded-[24px] px-4 py-3 text-caption shadow-soft", daysLeftTone(daysLeft))}>
      편집 가능 기간 {daysLeft}일 남음 (저장 후 7일까지 수정 가능)
    </p>
  );
}

function daysLeftTone(daysLeft: number): string {
  if (daysLeft <= 1) return "bg-rose-50 text-rose-700";
  if (daysLeft <= 3) return "bg-amber-50 text-amber-700";
  return "bg-white/92 text-ink-3";
}
