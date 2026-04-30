import Link from "next/link";
import { PurchaseForm } from "@/features/purchase/components/PurchaseForm";

export default function PurchasePage(): React.ReactElement {
  return (
    <main className="mx-auto flex min-h-screen max-w-screen-md flex-col gap-section p-screen pb-20">
      <header className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink-1">매입 등록</h1>
        <Link href="/inventory" className="text-body-regular text-ink-3 hover:text-ink-2">
          취소
        </Link>
      </header>
      <PurchaseForm />
    </main>
  );
}
