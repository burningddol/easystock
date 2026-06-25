"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { daysUntilDate, formatDateKoFromIso, formatNumber, localIsoDate } from "@/lib/utils/format";
import type { DepletionStatus } from "@/lib/domain/forecast";
import { useDeleteIngredient } from "@/features/purchase/hooks/useIngredients";
import type { IngredientForecastView } from "../hooks/useDepletionForecast";
import type { IngredientForecastAccuracyView } from "../hooks/useIngredientForecastAccuracy";

interface IngredientStatusListProps {
  items: readonly IngredientForecastView[];
  accuracyItems?: readonly IngredientForecastAccuracyView[];
}

const STATUS_GROUP_ORDER: readonly DepletionStatus[] = [
  "critical",
  "order_needed",
  "caution",
  "safe",
];

const STATUS_LABEL: Record<DepletionStatus, string> = {
  critical: "🔴 발주 필요 (긴급)",
  order_needed: "🟠 발주 권장",
  caution: "🟡 주의",
  safe: "🟢 안전",
};

export function IngredientStatusList({
  items,
  accuracyItems = [],
}: IngredientStatusListProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <p className="glow-panel rounded-2xl border border-border bg-card px-stack py-stack text-body-regular text-ink-3 shadow-soft">
        등록된 재료가 없어요. 매입을 등록하면 여기에 표시됩니다.
      </p>
    );
  }

  const grouped = new Map<DepletionStatus, IngredientForecastView[]>();
  const accuracyByIngredient = new Map(
    accuracyItems.map((accuracy) => [accuracy.ingredientId, accuracy]),
  );
  for (const item of items) {
    const list = grouped.get(item.status) ?? [];
    list.push(item);
    grouped.set(item.status, list);
  }

  return (
    <div className="flex flex-col gap-section">
      {STATUS_GROUP_ORDER.map((status) => {
        const list = grouped.get(status);
        if (!list || list.length === 0) return null;
        return (
          <section key={status} className="flex flex-col gap-stack-tight">
            <div className="flex items-center justify-between">
              <h2 className="text-title-md text-ink-1">{STATUS_LABEL[status]}</h2>
              <span className="rounded-full bg-blue-soft px-2.5 py-1 text-micro text-blue-deep shadow-soft">
                {list.length}개
              </span>
            </div>
            <ul className="flex flex-col gap-stack-tight">
              {list.map((item) => (
                <IngredientRow
                  key={item.ingredientId}
                  item={item}
                  accuracy={accuracyByIngredient.get(item.ingredientId)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function IngredientRow({
  item,
  accuracy,
}: {
  item: IngredientForecastView;
  accuracy?: IngredientForecastAccuracyView;
}): React.ReactElement {
  const depletionLabel = formatDepletion(item);
  const isOrderRecommended = Boolean(item.purchaseRecommendation?.isOrderRecommended);
  const deleteMutation = useDeleteIngredient();

  async function handleDelete(): Promise<void> {
    const confirmed = window.confirm(
      `"${item.name}" 재료를 삭제할까요?\n\n사용 중인 메뉴 + 단가 history는 보존되고 재료 목록에서만 사라져요.`,
    );
    if (!confirmed) return;
    const result = await deleteMutation.mutateAsync(item.ingredientId);
    if (result.inUseMenuCount > 0) {
      window.alert(
        `삭제 완료. 이 재료를 쓰던 메뉴 ${result.inUseMenuCount}개는 그대로 남아있어요. 메뉴 페이지에서 다른 재료로 교체하거나 메뉴 자체를 삭제하세요.`,
      );
    }
  }

  return (
    <li className="glow-panel flex flex-col gap-stack-tight rounded-[24px] border border-border bg-card px-tile py-stack shadow-card">
      <div className="flex items-start justify-between gap-stack">
        <div className="min-w-0 flex flex-col gap-1">
          <span className="text-body text-ink-1">{item.name}</span>
          <span className="text-caption text-ink-3 tabular-nums">
            현재 {formatAmount(item.currentStock, item.unit)}
          </span>
          {!isOrderRecommended && (
            <>
              <span className="text-caption text-ink-3">{formatLeadTimeSource(item)}</span>
              <span className="text-caption text-ink-3">{formatForecastSource(item)}</span>
              <span className="text-caption text-ink-3">{formatForecastBasis(item)}</span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-stack-tight">
          <div className="flex flex-col items-end gap-1 text-caption tabular-nums">
            <span className={cn(toneClass(item.status))}>{depletionLabel}</span>
            {item.trend !== "normal" && <TrendBadge trend={item.trend} />}
            {accuracy && <AccuracyBadge item={item} accuracy={accuracy} />}
          </div>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleteMutation.isPending}
            aria-label={`${item.name} 삭제`}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-caption text-ink-3 shadow-soft hover:border-red hover:text-red disabled:opacity-50"
          >
            ×
          </button>
        </div>
      </div>
      {deleteMutation.error && (
        <p role="alert" className="text-caption text-red">
          {deleteMutation.error.message}
        </p>
      )}
      {isOrderRecommended && <OrderRecommendationCard item={item} />}
    </li>
  );
}

function OrderRecommendationCard({
  item,
}: {
  item: IngredientForecastView;
}): React.ReactElement | null {
  const recommendation = item.purchaseRecommendation;
  if (!recommendation?.isOrderRecommended) return null;

  const quantity = Math.ceil(recommendation.recommendedOrderQuantity);
  const days = daysUntilDate(item.expectedDepletionDate);
  const orderByLabel = formatOrderByDate(recommendation.orderByDate);

  return (
    <div className="rounded-[22px] border border-red/15 bg-red-soft/70 px-3 py-3 text-red-deep shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-red px-2.5 py-1 text-micro font-semibold text-white shadow-soft">
              {formatDepletionBadge(days)}
            </span>
            <span className="text-caption font-semibold text-red-deep/70">권장 발주</span>
          </div>
          <p className="mt-1 text-title-lg tabular-nums text-red-deep">
            {formatAmount(quantity, item.unit)}
          </p>
          <p className="mt-1 text-caption text-red-deep/75">{orderByLabel}까지 매입 등록 권장</p>
        </div>
        <Link
          href={buildPurchasePrefillHref(item)}
          className="flex shrink-0 items-center justify-center rounded-xl bg-red px-4 py-2.5 text-label text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-red-deep"
        >
          권장량으로 매입 등록
        </Link>
      </div>

      <details className="mt-3 rounded-2xl bg-white/70 px-3 py-2 text-caption text-ink-2 shadow-soft">
        <summary className="cursor-pointer select-none font-semibold text-ink-1">근거 보기</summary>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
          <OrderFactor
            label="예상 소모량"
            value={formatAmount(recommendation.targetDemandQuantity, item.unit)}
          />
          <OrderFactor label="현재고" value={formatAmount(item.currentStock, item.unit)} />
          <OrderFactor label="리드타임" value={`${item.leadTimeDays}일`} />
          <OrderFactor label="안전여유" value={`${item.safetyBufferDays}일`} />
          <OrderFactor label="목표운영" value={`${recommendation.targetCoverageDays}일`} />
        </dl>
        <div className="mt-3 flex flex-col gap-1 leading-relaxed text-ink-3">
          <span>{formatForecastBasisCompact(item)}</span>
          <span>{formatForecastSource(item)}</span>
          <span>{formatLeadTimeSource(item)}</span>
        </div>
      </details>
    </div>
  );
}

function OrderFactor({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-2xl bg-card px-2 py-2 shadow-soft">
      <dt className="text-micro text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-caption font-semibold tabular-nums text-ink-1">{value}</dd>
    </div>
  );
}

function AccuracyBadge({
  item,
  accuracy,
}: {
  item: IngredientForecastView;
  accuracy: IngredientForecastAccuracyView;
}): React.ReactElement {
  const label = formatAccuracyLabel(item, accuracy);

  return (
    <Link
      href="/inventory/forecast-accuracy?tab=ingredient"
      className={cn(
        "rounded-full px-2 py-0.5 text-micro shadow-soft",
        accuracy.reliability === "good"
          ? "bg-blue-soft text-blue-deep"
          : accuracy.reliability === "watch"
            ? "bg-amber-soft text-amber-deep"
            : accuracy.reliability === "low"
              ? "bg-red-soft text-red-deep"
              : "bg-bg text-ink-3",
      )}
    >
      {label}
    </Link>
  );
}

function formatAccuracyLabel(
  item: IngredientForecastView,
  accuracy: IngredientForecastAccuracyView,
): string {
  const dayError = accuracy.meanAbsoluteDayEquivalentError;
  if (dayError === null || accuracy.evaluatedDayCount < 3) return "정확도 수집 중";
  const days = daysUntilDate(item.expectedDepletionDate);
  if (days === null) return `보통 ±${Number(dayError.toFixed(1))}일`;
  const earliestDays = Math.max(0, days - Math.ceil(dayError));
  return `보통 ±${Number(dayError.toFixed(1))}일 · 빠르면 ${earliestDays}일`;
}

function formatLeadTimeSource(item: IngredientForecastView): string {
  if (item.isDefaultLeadTime) {
    return "구매 이력이 없어 기본 1일 리드타임을 사용 중";
  }
  return item.leadTimeVendorName
    ? `${item.leadTimeVendorName} 거래처 이력 기준 리드타임 적용`
    : "최근 가장 자주 쓴 거래처 기준 리드타임 적용";
}

function formatForecastSource(item: IngredientForecastView): string {
  if (item.forecastSource === "menu_demand") {
    return "메뉴·옵션 판매 예측 기준";
  }
  return "최근 재료 사용량 기준";
}

function formatForecastBasis(item: IngredientForecastView): string {
  const confidence = Math.round(item.basis.averageWeekdayConfidence * 100);
  const label = CONFIDENCE_LABEL[item.basis.confidenceLevel];
  return `${label} · 데이터 ${item.basis.usableSampleCount}일 · 요일 보정 ${confidence}%`;
}

function formatForecastBasisCompact(item: IngredientForecastView): string {
  const label = CONFIDENCE_LABEL[item.basis.confidenceLevel];
  return `${label} · 데이터 ${item.basis.usableSampleCount}일 기준`;
}

const CONFIDENCE_LABEL: Record<IngredientForecastView["basis"]["confidenceLevel"], string> = {
  high: "예측 신뢰도 높음",
  medium: "예측 신뢰도 보통",
  low: "예측 신뢰도 낮음",
  collecting: "예측 데이터 수집 중",
};

const STATUS_TONE: Record<DepletionStatus, string> = {
  critical: "text-red-deep",
  order_needed: "text-amber-deep",
  caution: "text-amber-deep",
  safe: "text-ink-3",
};

function toneClass(status: DepletionStatus): string {
  return STATUS_TONE[status];
}

function formatDepletion(item: IngredientForecastView): string {
  const days = daysUntilDate(item.expectedDepletionDate);
  if (days === null) return "예측 데이터 부족";
  if (days === 0) return "오늘 소진";
  return `${days}일 후 소진`;
}

function formatDepletionBadge(days: number | null): string {
  if (days === null) return "예측 부족";
  if (days === 0) return "오늘";
  return `D-${days}`;
}

function formatAmount(value: number, unit: string): string {
  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit === "g" && Math.abs(value) >= 1000) {
    return `${formatDecimal(value / 1000)}kg`;
  }
  if (normalizedUnit === "ml" && Math.abs(value) >= 1000) {
    return `${formatDecimal(value / 1000)}L`;
  }
  return `${formatNumber(Math.round(value))}${unit}`;
}

function formatDecimal(value: number): string {
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
  });
}

function formatOrderByDate(date: Date | null): string {
  if (!date) return "발주일 미정";
  return formatDateKoFromIso(localIsoDate(date));
}

function buildPurchasePrefillHref(item: IngredientForecastView): string {
  const quantity = Math.ceil(item.purchaseRecommendation?.recommendedOrderQuantity ?? 0);
  const params = new URLSearchParams({
    ingredientId: item.ingredientId,
    quantity: String(quantity),
  });
  if (item.leadTimeVendorId) {
    params.set("vendorId", item.leadTimeVendorId);
  }
  return `/purchase?${params.toString()}`;
}

function TrendBadge({ trend }: { trend: "rising" | "falling" }): React.ReactElement {
  const isRising = trend === "rising";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-micro",
        isRising ? "bg-red-soft text-red-deep" : "bg-blue-soft text-blue-deep",
      )}
    >
      {isRising ? "사용량 증가" : "사용량 감소"}
    </span>
  );
}
