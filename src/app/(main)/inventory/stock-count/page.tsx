"use client";

import Link from "next/link";
import { StockCountForm } from "@/features/inventory/components/StockCountForm";

export default function StockCountPage(): React.ReactElement {
  return (
    <section className="flex flex-col gap-section">
      <header className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink-1">재고 실사</h1>
        <Link href="/inventory" className="text-body-regular text-ink-3 hover:text-ink-2">
          취소
        </Link>
      </header>
      <StockCountForm />
    </section>
  );
}
