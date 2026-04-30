import Link from "next/link";

export default function InventoryPage(): React.ReactElement {
  return (
    <section className="flex flex-col gap-stack">
      <header className="flex items-center justify-between">
        <h1 className="text-title-lg text-ink-1">재료</h1>
        <Link
          href="/purchase"
          className="rounded-md border border-border bg-card px-stack py-stack-tight text-body-regular text-ink-2 hover:bg-card-hover"
        >
          + 매입 등록
        </Link>
      </header>
      <p className="text-body-regular text-ink-3">소진 예측 + 재고 실사 — Phase 6에서 구현</p>
    </section>
  );
}
