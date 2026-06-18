"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SECONDARY_BUTTON_CLASSES } from "@/components/ui/button-classes";
import { ErrorAlert, LoadingText } from "@/components/ui/query-state";
import { useDepletionForecast } from "@/features/inventory/hooks/useDepletionForecast";
import { daysUntilDate, formatDateKoFromIso, formatNumber, localIsoDate } from "@/lib/utils/format";
import type { IngredientForecastView } from "@/lib/application/inventory";

interface OrderGroup {
  key: string;
  vendorId: string | null;
  vendorName: string;
  items: IngredientForecastView[];
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
          <section
            key={group.key}
            className="glow-panel flex flex-col gap-stack-tight rounded-[28px] border border-border bg-card p-5 shadow-card"
          >
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-micro uppercase tracking-[0.14em] text-blue-deep">Vendor</p>
                <h2 className="text-title-md text-ink-1">{group.vendorName}</h2>
                <p className="text-caption text-ink-3">{group.items.length}개 재료 발주 권장</p>
              </div>
              <Link
                href={buildPurchaseHref(group.items, group.vendorId)}
                className="halo-cta self-start rounded-2xl bg-brand-primary px-4 py-3 text-label font-semibold text-white shadow-card transition hover:-translate-y-0.5 sm:self-auto"
              >
                이 거래처 매입 등록
              </Link>
            </header>

            <ul className="flex flex-col gap-stack-tight">
              {group.items.map((item) => (
                <li
                  key={item.ingredientId}
                  className="rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-body text-ink-1">{item.name}</p>
                      <p className="text-caption text-ink-3">
                        현재 {formatNumber(item.currentStock)}
                        {item.unit} · {formatDepletion(item)} ·{" "}
                        {formatOrderByDate(item.purchaseRecommendation?.orderByDate ?? null)}까지
                      </p>
                    </div>
                    <div className="flex items-center gap-stack-tight">
                      <span className="rounded-full bg-blue-soft px-3 py-1.5 text-caption font-semibold text-blue-deep">
                        {formatNumber(
                          Math.ceil(item.purchaseRecommendation?.recommendedOrderQuantity ?? 0),
                        )}
                        {item.unit}
                      </span>
                      <Link
                        href={buildPurchaseHref([item], item.leadTimeVendorId)}
                        className="rounded-xl border border-border bg-card px-3 py-2 text-label text-ink-2 shadow-soft hover:bg-card-hover"
                      >
                        개별 등록
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
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
      } satisfies OrderGroup);
    group.items.push(item);
    groups.set(key, group);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.vendorId && !b.vendorId) return -1;
    if (!a.vendorId && b.vendorId) return 1;
    return a.vendorName.localeCompare(b.vendorName, "ko");
  });
}

function buildPurchaseHref(
  items: readonly IngredientForecastView[],
  vendorId: string | null,
): string {
  const params = new URLSearchParams();
  if (vendorId) params.set("vendorId", vendorId);
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
