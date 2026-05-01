"use client";

import { SaleInputForm } from "@/features/sale/components/SaleInputForm";
import { useIsFirstSale } from "@/features/sale/hooks/useIsFirstSale";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingText } from "@/components/ui/query-state";

export default function SalePage(): React.ReactElement {
  const { data: isFirstSale, isLoading } = useIsFirstSale();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="오늘 판매 입력"
        action={<span className="text-caption text-ink-3 tabular-nums">{today}</span>}
      />

      {isLoading || isFirstSale === undefined ? (
        <LoadingText />
      ) : (
        <SaleInputForm soldAt={today} isFirstSale={isFirstSale} />
      )}
    </section>
  );
}
