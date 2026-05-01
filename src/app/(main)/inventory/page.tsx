"use client";

import Link from "next/link";
import { useDepletionForecast } from "@/features/inventory/hooks/useDepletionForecast";
import { IngredientStatusList } from "@/features/inventory/components/IngredientStatusList";
import { ColdStartNotice } from "@/features/inventory/components/ColdStartNotice";
import { AddIngredientForm } from "@/features/inventory/components/AddIngredientForm";

export default function InventoryPage(): React.ReactElement {
  const { data, isLoading, error } = useDepletionForecast();

  const isAllColdStart = (data ?? []).length > 0 && (data ?? []).every((d) => d.isColdStart);

  return (
    <section className="flex flex-col gap-section">
      <header className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink-1">재료</h1>
        <div className="flex gap-stack-tight">
          <Link
            href="/inventory/stock-count"
            className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-2 hover:bg-card-hover"
          >
            실사
          </Link>
          <Link
            href="/purchase"
            className="rounded-md bg-ink-1 px-stack py-stack-tight text-body-regular text-bg hover:opacity-90"
          >
            + 매입
          </Link>
        </div>
      </header>

      {isLoading && <p className="text-body-regular text-ink-3">불러오는 중…</p>}

      {error && (
        <p role="alert" className="text-body-regular text-red">
          {error.message}
        </p>
      )}

      {isAllColdStart && <ColdStartNotice />}

      {data && <IngredientStatusList items={data} />}

      <AddIngredientForm />
    </section>
  );
}
