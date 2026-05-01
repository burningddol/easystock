"use client";

import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { formatDateKoFromIso, formatWon, parseLocalDateFromIso } from "@/lib/utils/format";
import { MARGIN_LABEL } from "@/lib/domain/margin";
import { Metric } from "@/components/ui/metric";
import type { EnrichedCalendarCell } from "../lib/consecutive-missing";

interface CellDetailPanelProps {
  cell: EnrichedCalendarCell;
  todayIso: string;
}

/**
 * 선택일 상세 패널 (patterns.md "캘린더" 위계 #4).
 *
 * 셀 상태에 따라 다른 카피 + 액션:
 * - 미래: "입력 불가" 안내
 * - 가입 전: "가입 전 데이터 없음"
 * - 정기휴무: "정기휴무일" 안내
 * - 누락 + 7일 이내: 큰 red 알림 + 입력 버튼 (/sale/[date]) — FR-022~024
 * - 누락 + 7일 초과: "이미 만료" 안내 (FR-024)
 * - 판매 있음: 매출/순익/마진율 메트릭 4-grid
 *
 * Toast 인프라 미존재 — T163 spec의 "토스트"는 인라인 패널로 대체.
 */
export function CellDetailPanel({ cell, todayIso }: CellDetailPanelProps): React.ReactElement {
  // todayIso는 호출 측에서 mount 후 채워진 값을 보장 (null guard는 page에서).
  const date = parseLocalDateFromIso(cell.date) ?? new Date();
  const today = parseLocalDateFromIso(todayIso) ?? new Date();
  const daysFromToday = differenceInCalendarDays(date, today);

  return (
    <article className="flex flex-col gap-stack rounded-xl border border-border bg-card p-tile">
      <header className="text-title-md text-ink-1">{formatDateKoFromIso(cell.date)}</header>
      <Body cell={cell} daysFromToday={daysFromToday} />
    </article>
  );
}

interface BodyProps {
  cell: EnrichedCalendarCell;
  daysFromToday: number;
}

function Body({ cell, daysFromToday }: BodyProps): React.ReactElement {
  if (cell.isFuture) {
    return <Notice tone="neutral">아직 오지 않은 날이에요. 미래 데이터는 입력할 수 없어요.</Notice>;
  }
  if (cell.isBeforeSignup) {
    return <Notice tone="neutral">가입 전 데이터예요.</Notice>;
  }
  if (cell.isRegularDayOff) {
    return <Notice tone="neutral">정기휴무일이에요.</Notice>;
  }
  if (cell.hasSale) {
    return <SaleSummary cell={cell} />;
  }
  if (cell.isMissing) {
    return <MissingActions cell={cell} daysFromToday={daysFromToday} />;
  }
  return <Notice tone="neutral">데이터가 없어요.</Notice>;
}

interface SaleSummaryProps {
  cell: EnrichedCalendarCell;
}

function SaleSummary({ cell }: SaleSummaryProps): React.ReactElement {
  const revenue = cell.revenue ?? 0;
  const netProfit = cell.netProfit ?? 0;
  const marginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  return (
    <div className="flex flex-col gap-stack-tight">
      <div className="grid grid-cols-2 gap-stack">
        <Metric label="매출" value={`${formatWon(revenue)}원`} />
        <Metric label="순수익" value={`${formatWon(netProfit)}원`} />
        <Metric label="마진율" value={`${marginPercent.toFixed(1)}%`} />
        <Metric label="매입" value={cell.hasPurchase ? "있음" : "—"} />
      </div>
      <p className="text-micro text-ink-3">{MARGIN_LABEL}</p>
    </div>
  );
}

interface MissingActionsProps {
  cell: EnrichedCalendarCell;
  daysFromToday: number;
}

function MissingActions({ cell, daysFromToday }: MissingActionsProps): React.ReactElement {
  // FR-024: 7일 초과 누락은 소급 입력 불가 (save_sale RPC도 거부)
  const isExpired = daysFromToday < -7;
  if (isExpired) {
    return (
      <Notice tone="neutral">
        7일이 지나 더 이상 입력할 수 없어요. 캘린더 통계에는 누락으로 남아요.
      </Notice>
    );
  }
  return (
    <div className="flex flex-col gap-stack-tight">
      <Notice tone="red">판매 입력이 비어있어요. 1분이면 끝나요.</Notice>
      <Link
        href={`/sale/${cell.date}`}
        data-calendar-action="missing-day-go"
        className="flex items-center justify-center rounded-xl bg-ink-1 py-3 text-body text-bg"
      >
        지금 입력하기
      </Link>
    </div>
  );
}

interface NoticeProps {
  tone: "red" | "neutral";
  children: React.ReactNode;
}

function Notice({ tone, children }: NoticeProps): React.ReactElement {
  return (
    <div
      className={cn(
        "rounded-lg p-tile text-body-regular",
        tone === "red" ? "bg-red-soft text-red-deep" : "bg-bg text-ink-3",
      )}
    >
      {children}
    </div>
  );
}
