"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SaleInputForm } from "@/features/sale/components/SaleInputForm";
import { SaleEditDialog } from "@/features/sale/components/SaleEditDialog";
import { useIsFirstSale } from "@/features/sale/hooks/useIsFirstSale";
import { useSaleByDate } from "@/features/sale/hooks/useSaleByDate";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function RetroactiveSalePage(): React.ReactElement {
  const { date } = useParams<{ date: string }>();
  const isValid = ISO_DATE_PATTERN.test(date);

  const { data: existingSale, isLoading: saleLoading } = useSaleByDate(date);
  const { data: isFirstSale, isLoading: firstSaleLoading } = useIsFirstSale();

  const isLoading = saleLoading || firstSaleLoading;
  const mode = existingSale ? "edit" : "input";

  return (
    <section className="flex flex-col gap-section">
      <header className="flex items-center justify-between">
        <Link href="/calendar" className="text-body-regular text-ink-3 hover:text-ink-2">
          ← 캘린더
        </Link>
        <span className="text-caption text-ink-3 tabular-nums">{date}</span>
      </header>

      <h1 className="text-title-lg text-ink-1">
        {date} {mode === "edit" ? "판매 수정" : "판매 입력"}
      </h1>

      {!isValid ? (
        <p className="text-body-regular text-red">잘못된 날짜 형식입니다.</p>
      ) : isLoading || isFirstSale === undefined ? (
        <p className="text-body-regular text-ink-3">불러오는 중…</p>
      ) : existingSale ? (
        <SaleEditDialog sale={existingSale} />
      ) : (
        <SaleInputForm soldAt={date} isFirstSale={isFirstSale} />
      )}
    </section>
  );
}
