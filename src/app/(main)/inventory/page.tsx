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

      <nav
        aria-label="재료 빠른 작업"
        className="rounded-[22px] border border-border bg-card px-4 py-4 shadow-soft"
      >
        <div>
          <h2 className="text-label text-ink-1">빠른 작업</h2>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {INVENTORY_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex min-h-[4.25rem] flex-col justify-center rounded-2xl border border-border-strong bg-white px-4 py-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-blue/30 hover:bg-blue-soft"
            >
              <span className="text-label font-semibold text-ink-1 group-hover:text-blue-deep">
                {action.label}
              </span>
              <span className="mt-1 text-caption text-ink-3">{action.description}</span>
            </Link>
          ))}
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

const INVENTORY_ACTIONS = [
  { href: "/purchase", label: "매입 등록", description: "재료를 사온 내역을 입력합니다." },
  {
    href: "/inventory/stock-count",
    label: "재고 실사",
    description: "실제 남은 수량으로 맞춥니다.",
  },
  {
    href: "/inventory/orders",
    label: "발주 추천",
    description: "부족해질 재료와 주문량을 봅니다.",
  },
  {
    href: "/inventory/forecast-accuracy",
    label: "예측 정확도",
    description: "매출·메뉴·재료 예측이 맞았는지 봅니다.",
  },
] as const;
