"use client";

import { isSaleLocked } from "@/lib/domain/snapshot";
import type { SaleWithItems } from "../hooks/useSaleByDate";
import { SaleEditForm } from "./SaleEditForm";
import { SaleLockedView } from "./SaleLockedView";

interface SaleEditDialogProps {
  sale: SaleWithItems;
}

/** Sale 편집 진입점 — 7일 lock(FR-030) 분기만 책임지고 두 view로 위임. */
export function SaleEditDialog({ sale }: SaleEditDialogProps): React.ReactElement {
  const createdAt = new Date(sale.created_at);
  if (isSaleLocked(createdAt)) {
    return <SaleLockedView sale={sale} />;
  }
  return <SaleEditForm sale={sale} createdAt={createdAt} />;
}
