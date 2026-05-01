"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMenus } from "@/features/menu/hooks/useMenus";
import { computeSnapshotPreview, daysUntilLock, isSaleLocked } from "@/lib/domain/snapshot";
import { MARGIN_LABEL } from "@/lib/domain/margin";
import { Field } from "@/components/ui/field";
import { PrimaryButton } from "@/components/ui/primary-button";
import { cn } from "@/lib/utils";
import { MenuRow } from "./MenuRow";
import { StickyTotalCard } from "./StickyTotalCard";
import { SaleSaveBar } from "./SaleSaveBar";
import { formatWon } from "@/lib/utils/format";
import { useSaleEdit, useSaleDelete } from "../hooks/useSaleEdit";
import { toSnapshotMenu } from "../lib/to-snapshot-menu";
import type { SaleWithItems } from "../hooks/useSaleByDate";

interface SaleEditDialogProps {
  sale: SaleWithItems;
}

export function SaleEditDialog({ sale }: SaleEditDialogProps): React.ReactElement {
  const router = useRouter();
  const { data: menus } = useMenus();
  const editMutation = useSaleEdit();
  const deleteMutation = useSaleDelete();

  // useMemo는 trivial Date 생성/Map 구성에 비용 오버헤드만 더함 — 단순 계산은 inline.
  const createdAt = new Date(sale.created_at);
  const isLocked = isSaleLocked(createdAt);
  const daysLeft = daysUntilLock(createdAt);

  // lazy 초기화 — initialQuantities 변경 시 setQuantities로 명시 재설정 (현재는 마운트 1회).
  const [quantities, setQuantities] = useState<Map<string, number>>(
    () => new Map(sale.items.map((it) => [it.menu_id, it.quantity])),
  );
  const [reason, setReason] = useState("");

  // quantities Map identity가 매번 새로워서 useMemo가 skip 못 함 → inline derive.
  const items = Array.from(quantities.entries())
    .filter(([, qty]) => qty > 0)
    .map(([menuId, quantity]) => ({ menuId, quantity }));

  const preview =
    menus && menus.length > 0 && items.length > 0
      ? computeSnapshotPreview(items, menus.map(toSnapshotMenu))
      : null;

  function setQuantity(menuId: string, next: number): void {
    setQuantities((prev) => {
      const updated = new Map(prev);
      if (next <= 0) {
        updated.delete(menuId);
      } else {
        updated.set(menuId, next);
      }
      return updated;
    });
  }

  function handleSave(): void {
    editMutation.mutate(
      { saleId: sale.id, newItems: items, reason: reason.trim() || undefined },
      { onSuccess: () => router.push("/today") },
    );
  }

  function handleDelete(): void {
    // TODO(design-system): AlertDialog 패턴 추가 시 교체.
    if (!confirm(`${sale.sold_at} 판매 기록을 삭제할까요? 재고는 자동 되돌립니다.`)) return;
    deleteMutation.mutate(sale.id, { onSuccess: () => router.push("/today") });
  }

  if (isLocked) {
    return <LockedView sale={sale} />;
  }

  if (!menus) {
    return <p className="text-body-regular text-ink-3">메뉴를 불러오는 중…</p>;
  }

  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);
  const isPending = editMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex flex-col gap-stack pb-44">
      <DaysLeftHint daysLeft={daysLeft} />

      <ul className="flex flex-col gap-stack-tight">
        {menus.map((menu) => (
          <MenuRow
            key={menu.id}
            menu={menu}
            quantity={quantities.get(menu.id) ?? 0}
            onChange={(next) => setQuantity(menu.id, next)}
          />
        ))}
      </ul>

      <Field label="수정 사유 (선택, 200자 이내)">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 200))}
          rows={2}
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-1"
          placeholder="예: 손님 환불, 잘못 입력 등"
        />
      </Field>

      {(editMutation.error || deleteMutation.error) && (
        <p role="alert" className="text-caption text-red">
          {editMutation.error?.message ?? deleteMutation.error?.message}
        </p>
      )}

      {preview && totalQuantity > 0 && <StickyTotalCard preview={preview} />}

      <SaleSaveBar
        left={
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className={cn(
              "rounded-md border border-border px-stack py-stack text-body-regular text-red hover:bg-red-soft",
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
            disabled={totalQuantity === 0 || isPending}
          >
            {editMutation.isPending ? "저장 중…" : "수정 저장"}
          </PrimaryButton>
        }
      />
    </div>
  );
}

function DaysLeftHint({ daysLeft }: { daysLeft: number }): React.ReactElement {
  return (
    <p className={cn("text-caption", daysLeftTone(daysLeft))}>
      편집 가능 기간 {daysLeft}일 남음 (저장 후 7일까지 수정 가능)
    </p>
  );
}

function daysLeftTone(daysLeft: number): string {
  if (daysLeft <= 1) return "text-red-deep";
  if (daysLeft <= 3) return "text-amber-deep";
  return "text-ink-3";
}

function LockedView({ sale }: { sale: SaleWithItems }): React.ReactElement {
  return (
    <article className="flex flex-col gap-stack rounded-lg border border-border bg-card p-tile">
      <div className="rounded-md bg-amber-soft p-stack text-body-regular text-amber-deep">
        저장 후 7일이 지나 수정할 수 없습니다. 기록은 보존됩니다.
      </div>
      <ul className="flex flex-col gap-1 text-body-regular text-ink-2 tabular-nums">
        <li className="flex justify-between">
          <span>매출</span>
          <span>{formatWon(sale.total_revenue)}원</span>
        </li>
        <li className="flex justify-between">
          <span>원가</span>
          <span>{formatWon(sale.total_cost_snapshot)}원</span>
        </li>
        <li className="flex justify-between">
          <span>순수익</span>
          <span>{formatWon(sale.total_revenue - sale.total_cost_snapshot)}원</span>
        </li>
      </ul>
      <p className="text-micro text-ink-3">{MARGIN_LABEL}</p>
    </article>
  );
}
