"use client";

import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { PageHeader } from "@/components/ui/page-header";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";
import { useOrderRecommendationReport } from "@/features/inventory/hooks/useOrderRecommendationReport";
import { formatDateKoFromIso, formatNumber, localIsoDate } from "@/lib/utils/format";
import type { OrderRecommendationReportData } from "@/lib/supabase/rpc";

type Snapshot = OrderRecommendationReportData["snapshots"][number];

export default function OrderRecommendationReportPage(): React.ReactElement {
  const query = useOrderRecommendationReport();
  const report = query.data;

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="발주 추천 이력"
        action={
          <div className="flex gap-stack-tight">
            <Link href="/inventory/orders" className={SECONDARY_BUTTON_CLASSES}>
              오늘 주문할 것
            </Link>
            <Link href="/inventory/forecast?tab=ingredient" className={SECONDARY_BUTTON_CLASSES}>
              재료 예측
            </Link>
          </div>
        }
      />

      <section className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
        <p className="text-body text-ink-1">
          최근 발주 추천이 실제 매입으로 이어졌는지 확인합니다.
        </p>
        <p className="mt-1 text-caption text-ink-3">
          과잉/부족 발주 분석은 이 이력이 쌓인 뒤 다음 단계에서 계산합니다.
        </p>
      </section>

      {query.isLoading && <LoadingText />}
      {query.error && <ErrorAlert message={query.error.message} />}

      {report && (
        <>
          <SummaryCards summary={report.summary} />
          {report.snapshots.length === 0 ? (
            <p className="glow-panel rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-3 shadow-soft">
              아직 저장된 발주 추천 이력이 없습니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-stack">
              {report.snapshots.map((snapshot) => (
                <SnapshotCard key={snapshot.snapshotId} snapshot={snapshot} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function SummaryCards({
  summary,
}: {
  summary: OrderRecommendationReportData["summary"];
}): React.ReactElement {
  return (
    <div className="grid gap-stack-tight md:grid-cols-3">
      <SummaryCard label="최근 추천" value={`${summary.snapshotCount}건`} />
      <SummaryCard label="매입 완료" value={`${summary.convertedCount}건`} tone="green" />
      <SummaryCard label="매입 전" value={`${summary.pendingCount}건`} tone="amber" />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "amber";
}): React.ReactElement {
  const toneClass =
    tone === "green"
      ? "bg-green-soft text-green"
      : tone === "amber"
        ? "bg-amber-soft text-amber-deep"
        : "bg-blue-soft text-blue-deep";
  return (
    <div className={`rounded-[24px] border border-border px-5 py-4 shadow-soft ${toneClass}`}>
      <p className="text-caption opacity-80">{label}</p>
      <p className="mt-1 text-title-md">{value}</p>
    </div>
  );
}

function SnapshotCard({ snapshot }: { snapshot: Snapshot }): React.ReactElement {
  const isConverted = Boolean(snapshot.purchaseOrderId);
  return (
    <li className="glow-panel rounded-[28px] border border-border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-micro uppercase tracking-[0.14em] text-blue-deep">
            {snapshot.vendorName ?? "거래처 미지정"}
          </p>
          <h2 className="mt-1 text-title-md text-ink-1">
            {formatDateTime(snapshot.createdAt)} 추천
          </h2>
          <p className="mt-1 text-caption text-ink-3">
            {snapshot.items.length}개 재료 · {elapsedLabel(snapshot.createdAt)}
          </p>
        </div>
        <span
          className={
            isConverted
              ? "rounded-full bg-green-soft px-3 py-1.5 text-caption font-semibold text-green"
              : "rounded-full bg-amber-soft px-3 py-1.5 text-caption font-semibold text-amber-deep"
          }
        >
          {isConverted
            ? `매입 완료${snapshot.purchasedAt ? ` · ${formatDateKoFromIso(snapshot.purchasedAt)}` : ""}`
            : "매입 전"}
        </span>
      </div>

      <ul className="mt-stack flex flex-col gap-2">
        {snapshot.items.map((item) => (
          <li
            key={`${snapshot.snapshotId}-${item.ingredientId}`}
            className="rounded-2xl border border-border bg-bg px-4 py-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-body text-ink-1">{item.ingredientName}</p>
                <p className="text-caption text-ink-3">
                  당시 재고 {formatNumber(item.currentStock)}
                  {item.unit} · {depletionLabel(item.expectedDepletionDate)} ·{" "}
                  {orderByLabel(item.orderByDate)}
                </p>
              </div>
              <span className="rounded-full bg-blue-soft px-3 py-1.5 text-caption font-semibold text-blue-deep">
                추천 {formatNumber(item.recommendedQuantity)}
                {item.unit}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDateKoFromIso(localIsoDate(date))} ${String(date.getHours()).padStart(
    2,
    "0",
  )}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function elapsedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시점 확인 불가";
  const days = Math.max(0, differenceInCalendarDays(new Date(), date));
  if (days === 0) return "오늘 추천";
  if (days === 1) return "어제 추천";
  return `${days}일 전 추천`;
}

function depletionLabel(value: string | null): string {
  if (!value) return "소진일 미정";
  return `${formatDateKoFromIso(value)} 소진 예상`;
}

function orderByLabel(value: string | null): string {
  if (!value) return "발주일 미정";
  return `${formatDateKoFromIso(value)}까지`;
}
