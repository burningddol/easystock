"use client";

import { SaleInputForm } from "@/features/sale/components/SaleInputForm";
import { useIsFirstSale } from "@/features/sale/hooks/useIsFirstSale";

export default function SalePage(): React.ReactElement {
  const { data: isFirstSale, isLoading } = useIsFirstSale();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="flex flex-col gap-section">
      <header className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink-1">오늘 판매 입력</h1>
        <span className="text-caption text-ink-3 tabular-nums">{today}</span>
      </header>

      {isLoading || isFirstSale === undefined ? (
        <p className="text-body-regular text-ink-3">불러오는 중…</p>
      ) : (
        <SaleInputForm soldAt={today} isFirstSale={isFirstSale} />
      )}
    </section>
  );
}
