"use client";

import { useState } from "react";
import Link from "next/link";
import { useDepletionForecast } from "@/features/inventory/hooks/useDepletionForecast";
import { IngredientStatusList } from "@/features/inventory/components/IngredientStatusList";
import { ColdStartNotice } from "@/features/inventory/components/ColdStartNotice";
import { AddIngredientForm } from "@/features/inventory/components/AddIngredientForm";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";

export default function InventoryPage(): React.ReactElement {
  const { data, isLoading, error } = useDepletionForecast();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const isAllColdStart = (data ?? []).length > 0 && (data ?? []).every((d) => d.isColdStart);

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="재료"
        action={
          <div className="flex gap-stack-tight">
            <Link href="/inventory/menu-forecast" className={SECONDARY_BUTTON_CLASSES}>
              메뉴 예측
            </Link>
            <Link href="/inventory/stock-count" className={SECONDARY_BUTTON_CLASSES}>
              실사
            </Link>
            <Link href="/purchase" className={SECONDARY_BUTTON_CLASSES}>
              + 매입
            </Link>
            <button
              type="button"
              onClick={() => setIsAddOpen((v) => !v)}
              aria-expanded={isAddOpen}
              className="halo-cta rounded-2xl bg-brand-primary px-4 py-3 text-body-regular font-semibold text-white shadow-card transition hover:-translate-y-0.5"
            >
              + 재료
            </button>
          </div>
        }
      />

      {isAddOpen && <AddIngredientForm onClose={() => setIsAddOpen(false)} />}

      {isLoading && <LoadingText />}
      {error && <ErrorAlert message={error.message} />}

      {isAllColdStart && <ColdStartNotice />}

      {data && <IngredientStatusList items={data} />}
    </section>
  );
}
