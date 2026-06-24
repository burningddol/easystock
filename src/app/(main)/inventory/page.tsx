"use client";

import { useState } from "react";
import Link from "next/link";
import { useDepletionForecast } from "@/features/inventory/hooks/useDepletionForecast";
import { useIngredientForecastAccuracy } from "@/features/inventory/hooks/useIngredientForecastAccuracy";
import { IngredientStatusList } from "@/features/inventory/components/IngredientStatusList";
import { ColdStartNotice } from "@/features/inventory/components/ColdStartNotice";
import { AddIngredientForm } from "@/features/inventory/components/AddIngredientForm";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";

export default function InventoryPage(): React.ReactElement {
  const { data, isLoading, error } = useDepletionForecast();
  const accuracyQuery = useIngredientForecastAccuracy(14);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const isAllColdStart = (data ?? []).length > 0 && (data ?? []).every((d) => d.isColdStart);

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="재료"
        action={
          <button
            type="button"
            onClick={() => setIsAddOpen((v) => !v)}
            aria-expanded={isAddOpen}
            className="whitespace-nowrap rounded-2xl bg-blue px-4 py-3 text-body-regular font-semibold text-white shadow-card ring-1 ring-blue-deep/10 transition hover:-translate-y-0.5 hover:bg-blue-deep"
          >
            + 재료
          </button>
        }
      />

      <nav aria-label="재료 빠른 작업" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-stack-tight sm:min-w-0 sm:flex-wrap">
          <Link href="/purchase" className={`${SECONDARY_BUTTON_CLASSES} whitespace-nowrap`}>
            + 매입
          </Link>
          <Link
            href="/inventory/orders"
            className={`${SECONDARY_BUTTON_CLASSES} whitespace-nowrap`}
          >
            발주 추천
          </Link>
          <Link
            href="/inventory/stock-count"
            className={`${SECONDARY_BUTTON_CLASSES} whitespace-nowrap`}
          >
            실사
          </Link>
        </div>
      </nav>

      {isAddOpen && <AddIngredientForm onClose={() => setIsAddOpen(false)} />}

      {isLoading && <LoadingText />}
      {error && <ErrorAlert message={error.message} />}

      {isAllColdStart && <ColdStartNotice />}

      {data && <IngredientStatusList items={data} accuracyItems={accuracyQuery.data ?? []} />}
    </section>
  );
}
