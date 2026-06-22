"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";
import { useDepletionForecast } from "@/features/inventory/hooks/useDepletionForecast";
import { useOrderRecommendationSnapshot } from "@/features/inventory/hooks/useOrderRecommendationSnapshot";
import { daysUntilDate, formatDateKoFromIso, formatNumber, localIsoDate } from "@/lib/utils/format";
import type { IngredientForecastView } from "@/lib/application/inventory";

interface OrderGroup {
  key: string;
  vendorId: string | null;
  vendorName: string;
  items: IngredientForecastView[];
  recommendedTotal: number;
  earliestOrderByDate: Date | null;
}

export default function InventoryOrdersPage(): React.ReactElement {
  const query = useDepletionForecast();
  const recommendedItems = (query.data ?? []).filter(
    (item) => item.purchaseRecommendation?.isOrderRecommended,
  );
  const groups = groupByVendor(recommendedItems);
  const coverageDays = recommendedItems[0]?.purchaseRecommendation?.targetCoverageDays ?? 7;

  return (
    <section className="flex flex-col gap-section">
      <PageHeader
        title="오늘 주문할 것"
        action={
          <div className="flex gap-stack-tight">
            <Link href="/inventory/orders/report" className={SECONDARY_BUTTON_CLASSES}>
              이력
            </Link>
            <Link href="/inventory" className={SECONDARY_BUTTON_CLASSES}>
              재료 예측
            </Link>
            <Link href="/purchase" className={SECONDARY_BUTTON_CLASSES}>
              직접 매입
            </Link>
          </div>
        }
      />

      <section className="rounded-[24px] border border-border bg-card px-5 py-5 shadow-soft">
        <p className="text-body text-ink-1">
          리드타임, 안전여유, {coverageDays}일 운영분 기준으로 지금 사야 할 재료만 모았습니다.
        </p>
        <p className="mt-1 text-caption text-ink-3">
          거래처가 같은 재료는 한 번에 매입 등록으로 넘길 수 있습니다.
        </p>
      </section>

      {query.isLoading && <LoadingText />}
      {query.error && <ErrorAlert message={query.error.message} />}

      {query.data && groups.length === 0 && (
        <p className="glow-panel rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-3 shadow-soft">
          오늘 바로 주문할 재료가 없습니다.
        </p>
      )}

      <div className="flex flex-col gap-section">
        {groups.map((group) => (
          <OrderGroupCard key={group.key} group={group} />
        ))}
      </div>
    </section>
  );
}

function OrderGroupCard({ group }: { group: OrderGroup }): React.ReactElement {
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const checkedCount = group.items.filter((item) => checkedIds.has(item.ingredientId)).length;

  function toggleItem(ingredientId: string): void {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  }

  async function copyOrderMemo(): Promise<void> {
    setCopyMessage(null);
    const memo = buildOrderMemo(group);
    try {
      await navigator.clipboard.writeText(memo);
      setCopyMessage("발주 메모를 복사했어요.");
    } catch {
      setCopyMessage("복사 권한이 없어 직접 선택해서 복사해 주세요.");
    }
  }

  return (
    <section className="glow-panel flex flex-col gap-stack rounded-[28px] border border-border bg-card p-5 shadow-card">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-micro uppercase tracking-[0.14em] text-blue-deep">Vendor</p>
          <h2 className="mt-1 text-title-md text-ink-1">{group.vendorName}</h2>
          <p className="mt-1 text-caption text-ink-3">
            {group.items.length}개 재료 · 총 권장 {formatNumber(group.recommendedTotal)} 단위
          </p>
        </div>
        <div className="flex flex-wrap gap-stack-tight">
          <button
            type="button"
            onClick={() => void copyOrderMemo()}
            className="rounded-2xl border border-border bg-card px-4 py-3 text-label font-semibold text-ink-2 shadow-soft transition hover:bg-card-hover"
          >
            발주 메모 복사
          </button>
          <OrderPurchaseButton
            items={group.items}
            vendorId={group.vendorId}
            className="halo-cta rounded-2xl bg-brand-primary px-4 py-3 text-label font-semibold text-white shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            이 거래처 매입 등록
          </OrderPurchaseButton>
        </div>
      </header>

      <div className="grid gap-stack-tight sm:grid-cols-3">
        <OrderMeta label="발주 마감" value={formatOrderByDate(group.earliestOrderByDate)} />
        <OrderMeta label="체크 완료" value={`${checkedCount}/${group.items.length}개`} />
        <OrderMeta
          label="처리 방식"
          value={group.vendorId ? "거래처 자동 선택" : "거래처 선택 필요"}
        />
      </div>

      {copyMessage && (
        <p className="rounded-2xl bg-blue-soft px-3 py-2 text-caption text-blue-deep">
          {copyMessage}
        </p>
      )}

      <ul className="flex flex-col gap-stack-tight">
        {group.items.map((item) => (
          <li
            key={item.ingredientId}
            className="rounded-2xl border border-border bg-white/90 px-4 py-3 shadow-soft"
          >
            <label className="flex cursor-pointer flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checkedIds.has(item.ingredientId)}
                  onChange={() => toggleItem(item.ingredientId)}
                  className="mt-1 h-5 w-5 rounded border-border text-brand-primary"
                />
                <div>
                  <p className="text-body font-semibold text-ink-1">{item.name}</p>
                  <p className="text-caption text-ink-3">
                    현재 {formatNumber(item.currentStock)}
                    {item.unit} · {formatDepletion(item)} ·{" "}
                    {formatOrderByDate(item.purchaseRecommendation?.orderByDate ?? null)}까지
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-stack-tight pl-8 sm:pl-0">
                <span className="rounded-full bg-blue-soft px-3 py-1.5 text-caption font-semibold text-blue-deep">
                  {formatNumber(
                    Math.ceil(item.purchaseRecommendation?.recommendedOrderQuantity ?? 0),
                  )}
                  {item.unit}
                </span>
                <OrderPurchaseButton
                  items={[item]}
                  vendorId={item.leadTimeVendorId}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-label text-ink-2 shadow-soft hover:bg-card-hover disabled:opacity-60"
                >
                  개별 등록
                </OrderPurchaseButton>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OrderMeta({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-bg px-4 py-3 shadow-soft">
      <p className="text-caption text-ink-3">{label}</p>
      <p className="mt-1 text-body font-semibold text-ink-1">{value}</p>
    </div>
  );
}

function OrderPurchaseButton({
  items,
  vendorId,
  className,
  children,
}: {
  items: readonly IngredientForecastView[];
  vendorId: string | null;
  className: string;
  children: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const snapshot = useOrderRecommendationSnapshot();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    setErrorMessage(null);
    try {
      const snapshotId = await snapshot.mutateAsync({ vendorId, items });
      router.push(buildPurchaseHref(items, vendorId, snapshotId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "발주 추천 저장에 실패했어요.");
    }
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={snapshot.isPending}
        className={className}
      >
        {snapshot.isPending ? "저장 중..." : children}
      </button>
      {errorMessage && (
        <span role="alert" className="text-caption text-red-deep">
          {errorMessage}
        </span>
      )}
    </span>
  );
}

function groupByVendor(items: readonly IngredientForecastView[]): OrderGroup[] {
  const groups = new Map<string, OrderGroup>();
  for (const item of items) {
    const key = item.leadTimeVendorId ?? "unknown";
    const group =
      groups.get(key) ??
      ({
        key,
        vendorId: item.leadTimeVendorId,
        vendorName: item.leadTimeVendorName ?? "거래처 선택 필요",
        items: [],
        recommendedTotal: 0,
        earliestOrderByDate: null,
      } satisfies OrderGroup);
    group.items.push(item);
    group.recommendedTotal += Math.ceil(item.purchaseRecommendation?.recommendedOrderQuantity ?? 0);
    group.earliestOrderByDate = minDate(
      group.earliestOrderByDate,
      item.purchaseRecommendation?.orderByDate ?? null,
    );
    groups.set(key, group);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.vendorId && !b.vendorId) return -1;
    if (!a.vendorId && b.vendorId) return 1;
    return a.vendorName.localeCompare(b.vendorName, "ko");
  });
}

function buildOrderMemo(group: OrderGroup): string {
  const lines = [
    `[이지스톡 발주] ${group.vendorName}`,
    `발주 마감: ${formatOrderByDate(group.earliestOrderByDate)}`,
    "",
    ...group.items.map((item) => {
      const quantity = Math.ceil(item.purchaseRecommendation?.recommendedOrderQuantity ?? 0);
      return `- ${item.name}: ${formatNumber(quantity)}${item.unit} (${formatDepletion(item)})`;
    }),
  ];
  return lines.join("\n");
}

function minDate(current: Date | null, next: Date | null): Date | null {
  if (!current) return next;
  if (!next) return current;
  return next.getTime() < current.getTime() ? next : current;
}

function buildPurchaseHref(
  items: readonly IngredientForecastView[],
  vendorId: string | null,
  snapshotId?: string,
): string {
  const params = new URLSearchParams();
  if (vendorId) params.set("vendorId", vendorId);
  if (snapshotId) params.set("snapshotId", snapshotId);
  for (const item of items) {
    const quantity = Math.ceil(item.purchaseRecommendation?.recommendedOrderQuantity ?? 0);
    if (quantity > 0) params.append("item", `${item.ingredientId}:${quantity}`);
  }
  return `/purchase?${params.toString()}`;
}

function formatDepletion(item: IngredientForecastView): string {
  const days = daysUntilDate(item.expectedDepletionDate);
  if (days === null) return "예측 데이터 부족";
  if (days === 0) return "오늘 소진";
  return `${days}일 후 소진`;
}

function formatOrderByDate(date: Date | null): string {
  if (!date) return "발주일 미정";
  return formatDateKoFromIso(localIsoDate(date));
}
