import { Suspense } from "react";
import Link from "next/link";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import { LoadingText } from "@/components/ui/query-state";
import { PurchaseForm } from "@/features/purchase/components/PurchaseForm";

export default function PurchasePage(): React.ReactElement {
  return (
    <main className="page-shell mx-auto flex min-h-screen max-w-screen-md flex-col gap-section p-screen pb-24">
      <header className="glow-panel rounded-[28px] border border-border bg-card px-5 py-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-micro uppercase tracking-[0.14em] text-blue-deep">Purchase</p>
            <h1 className="text-title-lg text-ink-1">매입 등록</h1>
          </div>
          <Link href="/inventory" className={SECONDARY_BUTTON_CLASSES}>
            취소
          </Link>
        </div>
      </header>
      <Suspense fallback={<LoadingText />}>
        <PurchaseForm />
      </Suspense>
    </main>
  );
}
