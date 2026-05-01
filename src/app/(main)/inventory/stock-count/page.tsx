"use client";

import Link from "next/link";
import { StockCountForm } from "@/features/inventory/components/StockCountForm";
import { PageHeader } from "@/components/ui/page-header";

export default function StockCountPage(): React.ReactElement {
  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="재고 실사"
        action={
          <Link href="/inventory" className="text-body-regular text-ink-3 hover:text-ink-2">
            취소
          </Link>
        }
      />
      <StockCountForm />
    </section>
  );
}
