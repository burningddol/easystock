"use client";

import { SaleInputForm } from "@/features/sale/components/SaleInputForm";
import { SaleEditDialog } from "@/features/sale/components/SaleEditDialog";
import { useIsFirstSale } from "@/features/sale/hooks/useIsFirstSale";
import { useSaleByDate } from "@/features/sale/hooks/useSaleByDate";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingText } from "@/components/ui/query-state";
import { useTodayIso } from "@/lib/utils/use-today-iso";

export default function SalePage(): React.ReactElement {
  const today = useTodayIso();
  const { data: existingSale, isLoading: saleLoading } = useSaleByDate(today);
  const { data: isFirstSale, isLoading: firstSaleLoading } = useIsFirstSale();
  const isLoading = saleLoading || firstSaleLoading || !today;
  const mode = existingSale ? "수정" : "입력";

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title={`오늘 판매 ${mode}`}
        action={<span className="text-caption text-ink-3 tabular-nums">{today}</span>}
      />

      {isLoading || isFirstSale === undefined ? (
        <LoadingText />
      ) : existingSale ? (
        <SaleEditDialog sale={existingSale} />
      ) : (
        <SaleInputForm soldAt={today} isFirstSale={isFirstSale} />
      )}
    </section>
  );
}
