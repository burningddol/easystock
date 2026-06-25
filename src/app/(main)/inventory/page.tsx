"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useDepletionForecast } from "@/features/inventory/hooks/useDepletionForecast";
import { useIngredientForecastAccuracy } from "@/features/inventory/hooks/useIngredientForecastAccuracy";
import { IngredientStatusList } from "@/features/inventory/components/IngredientStatusList";
import { ColdStartNotice } from "@/features/inventory/components/ColdStartNotice";
import { AddIngredientForm } from "@/features/inventory/components/AddIngredientForm";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen((v) => !v)}
              aria-expanded={isAddOpen}
              className="whitespace-nowrap rounded-2xl bg-blue px-4 py-3 text-body-regular font-semibold text-white shadow-card ring-1 ring-blue-deep/10 transition hover:-translate-y-0.5 hover:bg-blue-deep"
            >
              + 재료
            </button>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-1 rounded-2xl border border-border-strong bg-white px-4 py-3 text-body-regular font-semibold text-ink-1 shadow-soft transition hover:-translate-y-0.5 hover:border-blue/30 hover:bg-blue-soft [&::-webkit-details-marker]:hidden">
                <span>작업</span>
                <ChevronDown
                  size={16}
                  strokeWidth={2.2}
                  aria-hidden="true"
                  className="transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-44 overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-card">
                {INVENTORY_ACTIONS.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="block rounded-xl px-3 py-2.5 text-caption font-semibold text-ink-1 transition hover:bg-blue-soft hover:text-blue-deep"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </details>
          </div>
        }
      />

      {isAddOpen && <AddIngredientForm onClose={() => setIsAddOpen(false)} />}

      {isLoading && <LoadingText />}
      {error && <ErrorAlert message={error.message} />}

      {isAllColdStart && <ColdStartNotice />}

      {data && <IngredientStatusList items={data} accuracyItems={accuracyQuery.data ?? []} />}
    </section>
  );
}

const INVENTORY_ACTIONS = [
  { href: "/purchase", label: "매입 등록" },
  { href: "/inventory/stock-count", label: "재고 실사" },
  { href: "/inventory/orders", label: "발주 추천" },
  { href: "/inventory/forecast?tab=ingredient", label: "재료 예측" },
  { href: "/inventory/forecast-accuracy?tab=ingredient", label: "예측 정확도" },
] as const;
