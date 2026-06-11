"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { daysUntilDate } from "@/lib/utils/format";
import type { DashboardExpiryAlert } from "@/lib/supabase/rpc";
import type { IngredientForecastView } from "@/features/inventory/hooks/useDepletionForecast";

interface AlertsCardProps {
  depletionItems: readonly IngredientForecastView[];
  expiryAlerts: readonly DashboardExpiryAlert[];
  missingYesterdaySale: boolean;
  yesterdaySoldAt: string;
}

type AlertTone = "red" | "amber" | "blue";

interface AlertEntry {
  key: string;
  tone: AlertTone;
  title: string;
  body: string;
  href: string;
}

const TONE_CLASS: Record<AlertTone, { bg: string; text: string }> = {
  red: { bg: "bg-red-soft", text: "text-red-deep" },
  amber: { bg: "bg-amber-soft", text: "text-amber-deep" },
  blue: { bg: "bg-blue-soft", text: "text-blue-deep" },
};

/**
 * 오늘 할 일 알림 (patterns.md "홈" 위계 #3).
 * 우선순위: 발주(red) > 만료(amber) > 입력(blue). 최대 4개 노출 — 그 이상은 "더보기" 링크로 위임.
 */
export function AlertsCard({
  depletionItems,
  expiryAlerts,
  missingYesterdaySale,
  yesterdaySoldAt,
}: AlertsCardProps): React.ReactElement | null {
  const alerts = buildAlerts(depletionItems, expiryAlerts, missingYesterdaySale, yesterdaySoldAt);
  if (alerts.length === 0) return null;

  const visible = alerts.slice(0, 4);
  const remaining = alerts.length - visible.length;

  return (
    <section className="flex flex-col gap-stack-tight">
      <div className="flex items-center justify-between">
        <h2 className="text-label text-ink-3">오늘 할 일</h2>
        <span className="rounded-full bg-blue-soft px-2.5 py-1 text-micro text-blue-deep shadow-soft">
          {alerts.length}개
        </span>
      </div>
      <ul className="flex flex-col gap-stack-tight">
        {visible.map((alert) => (
          <AlertRow key={alert.key} alert={alert} />
        ))}
      </ul>
      {remaining > 0 && (
        <Link href="/inventory" className="text-caption text-ink-3 underline">
          + {remaining}개 더 보기
        </Link>
      )}
    </section>
  );
}

interface AlertRowProps {
  alert: AlertEntry;
}

function AlertRow({ alert }: AlertRowProps): React.ReactElement {
  const tone = TONE_CLASS[alert.tone];
  return (
    <li>
      <Link
        href={alert.href}
        className={cn(
          "flex items-start gap-stack-tight rounded-2xl border border-border p-tile shadow-soft",
          tone.bg,
          tone.text,
        )}
      >
        <div className="flex-1">
          <div className="text-body">{alert.title}</div>
          <div className="text-caption opacity-85">{alert.body}</div>
        </div>
        <span aria-hidden className="text-caption">
          ›
        </span>
      </Link>
    </li>
  );
}

function buildAlerts(
  depletionItems: readonly IngredientForecastView[],
  expiryAlerts: readonly DashboardExpiryAlert[],
  missingYesterdaySale: boolean,
  yesterdaySoldAt: string,
): AlertEntry[] {
  const result: AlertEntry[] = [];

  // 1. 발주 (red) — critical + order_needed
  for (const item of depletionItems) {
    if (item.status !== "critical" && item.status !== "order_needed") continue;
    const isCritical = item.status === "critical";
    result.push({
      key: `depletion-${item.ingredientId}`,
      tone: isCritical ? "red" : "amber",
      title: isCritical ? `${item.name} 곧 소진 — 즉시 발주` : `${item.name} 발주 권장`,
      body: depletionBody(item),
      href: "/inventory",
    });
  }

  // 2. 만료 (amber)
  for (const e of expiryAlerts) {
    result.push({
      key: `expiry-${e.ingredientId}`,
      tone: "amber",
      title: `${e.name} 유통기한 ${expiryLabel(e.daysUntilExpiry)}`,
      body: `만료일 ${e.expiryDate}`,
      href: "/inventory",
    });
  }

  // 3. 어제 입력 누락 (blue)
  if (missingYesterdaySale) {
    result.push({
      key: "missing-sale",
      tone: "blue",
      title: "어제 판매 입력이 비어있어요",
      body: "1분이면 끝나요. 마진이 바로 계산돼요.",
      href: `/sale/${yesterdaySoldAt}`,
    });
  }

  return result;
}

function depletionBody(item: IngredientForecastView): string {
  const days = daysUntilDate(item.expectedDepletionDate);
  if (days === null) return `현재 ${item.currentStock}${item.unit}`;
  const prefix = days === 0 ? "오늘 소진 예상" : `${days}일 후 소진`;
  const leadTimeSource = item.isDefaultLeadTime
    ? "기본 1일"
    : item.leadTimeVendorName
      ? `${item.leadTimeVendorName} 기준`
      : "거래처 이력 기준";
  return `${prefix} · 리드타임 ${item.leadTimeDays}일 (${leadTimeSource})`;
}

function expiryLabel(days: number): string {
  if (days <= 0) return "오늘 만료";
  if (days === 1) return "내일 만료";
  return `${days}일 남음`;
}
