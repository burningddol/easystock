"use client";

import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { useParams } from "next/navigation";
import { useCalendarMonth } from "@/features/calendar/hooks/useCalendarMonth";
import { useMenuForecastAccuracy } from "@/features/inventory/hooks/useMenuForecastAccuracy";
import { useMenuDemandForecast } from "@/features/inventory/hooks/useMenuDemandForecast";
import { useRevenueForecastAccuracy } from "@/features/inventory/hooks/useRevenueForecastAccuracy";
import { useSaleByDate, type SaleWithItems } from "@/features/sale/hooks/useSaleByDate";
import {
  buildCalendarMenuForecastByDate,
  type CalendarMenuForecastSummary,
} from "@/features/calendar/lib/menu-forecast-calendar";
import { CALENDAR_SHORT_FORECAST_DAYS } from "@/features/calendar/lib/forecast-window";
import { daysUntilLock, isSaleLocked } from "@/lib/domain/snapshot";
import { MARGIN_LABEL } from "@/lib/domain/margin";
import {
  formatDateKoFromIso,
  formatNumber,
  formatWon,
  localIsoDate,
  parseLocalDateFromIso,
} from "@/lib/utils/format";
import { useTodayIso } from "@/lib/utils/use-today-iso";
import { Metric } from "@/components/ui/metric";
import { cn } from "@/lib/utils";
import type { EnrichedCalendarCell } from "@/features/calendar/lib/consecutive-missing";
import type { MenuForecastAccuracyView } from "@/features/inventory/hooks/useMenuForecastAccuracy";
import type { RevenueForecastAccuracyView } from "@/features/inventory/hooks/useRevenueForecastAccuracy";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function CalendarDateDetailPage(): React.ReactElement {
  const params = useParams<{ date: string }>();
  const date = params.date;
  const parsedDate = DATE_PATTERN.test(date) ? parseLocalDateFromIso(date) : null;
  const year = parsedDate?.getFullYear() ?? null;
  const month = parsedDate ? parsedDate.getMonth() + 1 : null;
  const todayIso = useTodayIso();
  const today = todayIso ? (parseLocalDateFromIso(todayIso) ?? new Date()) : new Date();
  const daysFromToday = parsedDate ? differenceInCalendarDays(parsedDate, today) : 0;
  const isFutureDate = daysFromToday > 0;
  const isShortForecastDate = isFutureDate && daysFromToday <= CALENDAR_SHORT_FORECAST_DAYS;
  const forecastHorizonDays = isShortForecastDate
    ? Math.max(CALENDAR_SHORT_FORECAST_DAYS, daysFromToday + 1)
    : CALENDAR_SHORT_FORECAST_DAYS;
  const calendarQuery = useCalendarMonth(year, month);
  const saleQuery = useSaleByDate(date);
  const menuForecastQuery = useMenuDemandForecast(forecastHorizonDays);
  const menuAccuracyQuery = useMenuForecastAccuracy(30);
  const revenueAccuracyQuery = useRevenueForecastAccuracy(30, !isFutureDate);

  if (!parsedDate) {
    return (
      <section className="flex flex-col gap-section">
        <BackLink />
        <Notice tone="neutral">올바른 날짜가 아니에요.</Notice>
      </section>
    );
  }

  const cell = calendarQuery.data?.cells.find((item) => item.date === date) ?? null;
  const menuForecast =
    buildCalendarMenuForecastByDate(menuForecastQuery.data ?? []).get(date) ?? null;
  const menuBacktest = buildMenuBacktestSummaryForDate(date, menuAccuracyQuery.data ?? []);
  const revenueBacktest = buildRevenueBacktestSummaryForDate(date, revenueAccuracyQuery.data);
  const prevDate = addDaysIso(parsedDate, -1);
  const nextDate = addDaysIso(parsedDate, 1);

  return (
    <section className="flex flex-col gap-section">
      <header className="flex flex-col gap-stack">
        <BackLink />
        <div className="flex flex-col gap-stack-tight rounded-xl border border-border bg-card p-tile">
          <p className="text-micro text-ink-3">날짜 상세</p>
          <div className="flex items-start justify-between gap-stack">
            <div className="flex flex-col gap-1">
              <h1 className="text-title-lg text-ink-1">{formatDateKoFromIso(date)}</h1>
              <p className="text-body-regular text-ink-3">{date}</p>
            </div>
            <DatePager prevDate={prevDate} nextDate={nextDate} />
          </div>
        </div>
      </header>

      {calendarQuery.isLoading ||
      saleQuery.isLoading ||
      (isFutureDate && menuForecastQuery.isLoading) ||
      !todayIso ? (
        <p className="text-body-regular text-ink-3">불러오는 중…</p>
      ) : calendarQuery.error || saleQuery.error || (isFutureDate && menuForecastQuery.error) ? (
        <Notice tone="red">날짜 상세를 불러오지 못했어요. 잠시 후 다시 시도해주세요.</Notice>
      ) : (
        <DateDetailBody
          cell={cell}
          date={date}
          parsedDate={parsedDate}
          sale={saleQuery.data ?? null}
          menuForecast={menuForecast}
          menuBacktest={menuBacktest}
          revenueBacktest={revenueBacktest}
          todayIso={todayIso}
          isShortForecastDate={isShortForecastDate}
        />
      )}
    </section>
  );
}

interface DateDetailBodyProps {
  cell: EnrichedCalendarCell | null;
  date: string;
  parsedDate: Date;
  sale: SaleWithItems | null;
  menuForecast: CalendarMenuForecastSummary | null;
  menuBacktest: MenuBacktestDateSummary | null;
  revenueBacktest: RevenueBacktestDateSummary | null;
  todayIso: string;
  isShortForecastDate: boolean;
}

function DateDetailBody({
  cell,
  date,
  parsedDate,
  sale,
  menuForecast,
  menuBacktest,
  revenueBacktest,
  todayIso,
  isShortForecastDate,
}: DateDetailBodyProps): React.ReactElement {
  const today = parseLocalDateFromIso(todayIso) ?? new Date();
  const daysFromToday = differenceInCalendarDays(parsedDate, today);

  if (cell?.isFuture) {
    return (
      <FutureForecastDetail
        date={date}
        forecast={isShortForecastDate ? menuForecast : null}
        isShortForecastDate={isShortForecastDate}
      />
    );
  }
  if (cell?.isBeforeSignup) {
    return <Notice tone="neutral">가입 전 데이터예요.</Notice>;
  }
  if (cell?.isRegularDayOff) {
    return <Notice tone="neutral">정기휴무일이에요.</Notice>;
  }
  if (sale) {
    return (
      <ExistingSaleDetail
        sale={sale}
        hasPurchase={cell?.hasPurchase ?? false}
        menuBacktest={menuBacktest}
        revenueBacktest={revenueBacktest}
      />
    );
  }
  return <MissingSaleDetail date={date} daysFromToday={daysFromToday} />;
}

function FutureForecastDetail({
  date,
  forecast,
  isShortForecastDate,
}: {
  date: string;
  forecast: CalendarMenuForecastSummary | null;
  isShortForecastDate: boolean;
}): React.ReactElement {
  if (!isShortForecastDate) {
    return (
      <Notice tone="neutral">
        캘린더는 오늘부터 {CALENDAR_SHORT_FORECAST_DAYS}일 이내 단기 예측만 보여줘요. 14일·30일 장기
        참고치는 메뉴 수요 예측 화면에서 확인해 주세요.
      </Notice>
    );
  }

  if (!forecast || forecast.items.length === 0) {
    return (
      <Notice tone="neutral">
        아직 오지 않은 날이에요. 예측할 판매 이력이 부족해서 메뉴 소요량을 표시하지 못했어요.
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <article className="flex flex-col gap-stack rounded-xl border border-border bg-card p-tile">
        <div className="flex flex-col gap-stack-tight">
          <p className="text-micro text-ink-3">현재 예측 모델 기준</p>
          <div className="grid grid-cols-2 gap-stack">
            <Metric label="예상 매출" value={`${formatWon(forecast.totalRevenue)}원`} />
            <Metric label="예상 판매" value={`${formatNumber(forecast.totalQuantity)}개`} />
          </div>
          <Notice tone="neutral">
            캘린더는 오늘부터 {CALENDAR_SHORT_FORECAST_DAYS}일 이내 단기 예측만 보여줘요. 장기
            구간은 메뉴 수요 예측 화면에서 참고용으로 확인하세요.
          </Notice>
          <ForecastConfidenceNote forecast={forecast} />
        </div>
      </article>

      <article className="flex flex-col gap-stack rounded-xl border border-border bg-card p-tile">
        <div className="flex items-center justify-between gap-stack">
          <h2 className="text-title-md text-ink-1">예측 메뉴 소요량</h2>
          <span className="text-micro text-ink-3">{date}</span>
        </div>
        <ul className="flex flex-col gap-stack-tight">
          {forecast.items.map((item) => (
            <li key={item.menuId} className="rounded-lg bg-bg p-stack">
              <div className="flex items-start justify-between gap-stack">
                <div className="flex flex-col gap-1">
                  <p className="text-body text-ink-1">{item.name}</p>
                  <p className="text-micro text-ink-3">
                    예상 {formatNumber(Number(item.predictedQuantity.toFixed(1)))}개 ×{" "}
                    {formatWon(item.price)}원
                  </p>
                  <p className="text-micro text-ink-4">
                    {CONFIDENCE_LABEL[item.confidenceLevel]} · 데이터 {item.usableSampleCount}일 ·
                    요일 보정 {Math.round(item.weekdayConfidence * 100)}%
                  </p>
                </div>
                <p className="text-body tabular-nums text-ink-1">
                  {formatWon(item.predictedRevenue)}원
                </p>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function ForecastConfidenceNote({
  forecast,
}: {
  forecast: CalendarMenuForecastSummary;
}): React.ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-bg px-3 py-2 text-caption text-ink-3">
      <p className="font-semibold text-ink-2">{CONFIDENCE_LABEL[forecast.confidenceLevel]}</p>
      <p className="mt-1">
        메뉴별 최소 데이터 {forecast.minSampleCount}일 · 평균 요일 보정{" "}
        {Math.round(forecast.averageWeekdayConfidence * 100)}% 기준입니다.
      </p>
    </div>
  );
}

interface ExistingSaleDetailProps {
  sale: SaleWithItems;
  hasPurchase: boolean;
  menuBacktest: MenuBacktestDateSummary | null;
  revenueBacktest: RevenueBacktestDateSummary | null;
}

function ExistingSaleDetail({
  sale,
  hasPurchase,
  menuBacktest,
  revenueBacktest,
}: ExistingSaleDetailProps): React.ReactElement {
  const totalRevenue = sale.total_revenue;
  const totalCost = sale.total_cost_snapshot;
  const netProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const createdAt = new Date(sale.created_at);
  const locked = isSaleLocked(createdAt);
  const daysLeft = daysUntilLock(createdAt);

  return (
    <div className="flex flex-col gap-section">
      <article className="flex flex-col gap-stack rounded-xl border border-border bg-card p-tile">
        <div className="flex flex-col gap-stack-tight">
          <div className="grid grid-cols-2 gap-stack">
            <Metric label="매출" value={`${formatWon(totalRevenue)}원`} />
            <Metric label="순수익" value={`${formatWon(netProfit)}원`} />
            <Metric label="마진율" value={`${marginPercent.toFixed(1)}%`} />
            <Metric label="매입" value={hasPurchase ? "있음" : "없음"} />
          </div>
          <p className="text-micro text-ink-3">{MARGIN_LABEL}</p>
        </div>

        {locked ? (
          <Notice tone="neutral">저장 후 7일이 지나 수정이 잠겼어요. 기록 확인만 가능해요.</Notice>
        ) : (
          <div className="flex flex-col gap-stack-tight">
            <Notice tone="neutral">수정 가능 기간이 {daysLeft}일 남았어요.</Notice>
            <PrimaryAction href={`/sale/${sale.sold_at}`}>수정하기</PrimaryAction>
          </div>
        )}
      </article>

      <article className="flex flex-col gap-stack rounded-xl border border-border bg-card p-tile">
        <div className="flex items-center justify-between gap-stack">
          <h2 className="text-title-md text-ink-1">판매 내역</h2>
          <span className="text-micro text-ink-3">{formatNumber(sale.items.length)}개 메뉴</span>
        </div>
        <ul className="flex flex-col gap-stack-tight">
          {sale.items.map((item) => (
            <SaleItemRow key={item.id} item={item} />
          ))}
        </ul>
      </article>

      {revenueBacktest && <RevenueBacktestComparison summary={revenueBacktest} />}
      {menuBacktest && <MenuBacktestComparison summary={menuBacktest} />}
    </div>
  );
}

interface RevenueBacktestDateSummary {
  actualRevenue: number;
  predictedRevenue: number;
  absoluteWonError: number;
  weightedAbsolutePercentageError: number | null;
  reliability: MenuForecastAccuracyView["reliability"];
  bias: "over" | "under" | "balanced" | "insufficient_data";
}

function RevenueBacktestComparison({
  summary,
}: {
  summary: RevenueBacktestDateSummary;
}): React.ReactElement {
  return (
    <article className="flex flex-col gap-stack rounded-xl border border-border bg-card p-tile">
      <div className="flex items-start justify-between gap-stack">
        <div>
          <h2 className="text-title-md text-ink-1">매출 예측 vs 실제</h2>
          <p className="mt-1 text-caption text-ink-3">
            백테스트 기준 · {RELIABILITY_LABEL[summary.reliability]} ·{" "}
            {REVENUE_BIAS_LABEL[summary.bias]}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-micro",
            summary.reliability === "low"
              ? "bg-red-soft text-red-deep"
              : summary.reliability === "watch"
                ? "bg-amber-soft text-amber-deep"
                : "bg-blue-soft text-blue-deep",
          )}
        >
          WAPE{" "}
          {summary.weightedAbsolutePercentageError === null
            ? "-"
            : `${Math.round(summary.weightedAbsolutePercentageError * 100)}%`}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-stack">
        <Metric label="실제 매출" value={`${formatWon(summary.actualRevenue)}원`} />
        <Metric label="예측 매출" value={`${formatWon(summary.predictedRevenue)}원`} />
        <Metric label="오차" value={`${formatWon(summary.absoluteWonError)}원`} />
      </div>
    </article>
  );
}

function MenuBacktestComparison({
  summary,
}: {
  summary: MenuBacktestDateSummary;
}): React.ReactElement {
  return (
    <article className="flex flex-col gap-stack rounded-xl border border-border bg-card p-tile">
      <div className="flex items-start justify-between gap-stack">
        <div>
          <h2 className="text-title-md text-ink-1">당시 예측 vs 실제</h2>
          <p className="mt-1 text-caption text-ink-3">
            백테스트 기준 · {RELIABILITY_LABEL[summary.reliability]}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-micro",
            summary.reliability === "low"
              ? "bg-red-soft text-red-deep"
              : summary.reliability === "watch"
                ? "bg-amber-soft text-amber-deep"
                : "bg-blue-soft text-blue-deep",
          )}
        >
          평균 수량오차{" "}
          {summary.meanAbsoluteQuantityError === null
            ? "-"
            : `${formatNumber(Number(summary.meanAbsoluteQuantityError.toFixed(1)))}개`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-stack">
        <Metric label="실제 판매" value={`${formatNumber(summary.actualTotalQuantity)}개`} />
        <Metric label="예측 판매" value={`${formatNumber(summary.predictedTotalQuantity)}개`} />
      </div>
      <ul className="flex flex-col gap-stack-tight">
        {summary.items.slice(0, 5).map((item) => (
          <li key={item.menuId} className="rounded-lg bg-bg p-stack">
            <div className="flex items-start justify-between gap-stack">
              <div>
                <p className="text-body text-ink-1">{item.name}</p>
                <p className="text-micro text-ink-3">
                  실제 {formatNumber(item.actualQuantity)}개 · 예측{" "}
                  {formatNumber(Number(item.predictedQuantity.toFixed(1)))}개
                </p>
              </div>
              <p className="text-caption text-ink-3">
                오차 {formatNumber(Number(item.absoluteQuantityError.toFixed(1)))}개
              </p>
            </div>
          </li>
        ))}
      </ul>
      {summary.items.length > 5 && (
        <p className="text-caption text-ink-3">
          오차가 큰 메뉴 5개만 먼저 보여줘요. 전체 비교는 예측 정확도 화면에서 확인하세요.
        </p>
      )}
    </article>
  );
}

interface SaleItemRowProps {
  item: SaleWithItems["items"][number];
}

function SaleItemRow({ item }: SaleItemRowProps): React.ReactElement {
  const lineRevenue = item.quantity * item.unit_price;
  const lineCost = item.quantity * item.menu_cost_snapshot;
  const lineProfit = lineRevenue - lineCost;

  return (
    <li className="rounded-lg bg-bg p-stack">
      <div className="flex items-start justify-between gap-stack">
        <div className="flex flex-col gap-1">
          <p className="text-body text-ink-1">{item.menu_name ?? "메뉴명 없음"}</p>
          <p className="text-micro text-ink-3">
            {formatNumber(item.quantity)}개 × {formatWon(item.unit_price)}원
          </p>
        </div>
        <p className="text-body tabular-nums text-ink-1">{formatWon(lineRevenue)}원</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-stack-tight text-micro text-ink-3">
        <div>
          <dt>원가</dt>
          <dd className="tabular-nums">{formatWon(lineCost)}원</dd>
        </div>
        <div>
          <dt>순수익</dt>
          <dd className="tabular-nums">{formatWon(lineProfit)}원</dd>
        </div>
      </dl>
    </li>
  );
}

interface MissingSaleDetailProps {
  date: string;
  daysFromToday: number;
}

function MissingSaleDetail({ date, daysFromToday }: MissingSaleDetailProps): React.ReactElement {
  const isExpired = daysFromToday < -7;
  if (isExpired) {
    return (
      <Notice tone="neutral">
        7일이 지나 더 이상 판매를 입력할 수 없어요. 캘린더 통계에는 누락으로 남아요.
      </Notice>
    );
  }
  return (
    <article className="flex flex-col gap-stack rounded-xl border border-border bg-card p-tile">
      <Notice tone="red">판매 입력이 비어있어요. 오늘 매출 흐름을 맞추려면 입력해 주세요.</Notice>
      <PrimaryAction href={`/sale/${date}`}>판매 입력하기</PrimaryAction>
    </article>
  );
}

interface DatePagerProps {
  prevDate: string;
  nextDate: string;
}

function DatePager({ prevDate, nextDate }: DatePagerProps): React.ReactElement {
  return (
    <nav className="flex shrink-0 gap-2" aria-label="날짜 이동">
      <Link
        className="rounded-lg border border-border px-3 py-2 text-micro text-ink-2"
        href={`/calendar/${prevDate}`}
      >
        이전날
      </Link>
      <Link
        className="rounded-lg border border-border px-3 py-2 text-micro text-ink-2"
        href={`/calendar/${nextDate}`}
      >
        다음날
      </Link>
    </nav>
  );
}

function BackLink(): React.ReactElement {
  return (
    <Link
      className="w-fit text-body-regular text-ink-3 underline-offset-4 hover:underline"
      href="/calendar"
    >
      캘린더로 돌아가기
    </Link>
  );
}

interface PrimaryActionProps {
  href: string;
  children: React.ReactNode;
}

function PrimaryAction({ href, children }: PrimaryActionProps): React.ReactElement {
  return (
    <Link
      className="flex items-center justify-center rounded-xl bg-ink-1 py-3 text-body text-bg"
      href={href}
    >
      {children}
    </Link>
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

interface MenuBacktestDateSummary {
  actualTotalQuantity: number;
  predictedTotalQuantity: number;
  meanAbsoluteQuantityError: number | null;
  reliability: MenuForecastAccuracyView["reliability"];
  items: Array<{
    menuId: string;
    name: string;
    actualQuantity: number;
    predictedQuantity: number;
    absoluteQuantityError: number;
  }>;
}

function buildMenuBacktestSummaryForDate(
  date: string,
  items: readonly MenuForecastAccuracyView[],
): MenuBacktestDateSummary | null {
  const results = items
    .map((item) => {
      const result = item.dailyResults.find((day) => localIsoDate(day.date) === date);
      if (!result) return null;
      return {
        menuId: item.menuId,
        name: item.name,
        actualQuantity: result.actualQuantity,
        predictedQuantity: result.predictedQuantity,
        absoluteQuantityError: result.absoluteQuantityError,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (results.length === 0) return null;

  const actualTotalQuantity = results.reduce((sum, item) => sum + item.actualQuantity, 0);
  const predictedTotalQuantity = results.reduce((sum, item) => sum + item.predictedQuantity, 0);
  const evaluated = results.filter((item) => item.actualQuantity > 0);
  const meanAbsoluteQuantityError =
    evaluated.length > 0
      ? evaluated.reduce((sum, item) => sum + item.absoluteQuantityError, 0) / evaluated.length
      : null;
  const wape =
    actualTotalQuantity > 0
      ? results.reduce((sum, item) => sum + item.absoluteQuantityError, 0) / actualTotalQuantity
      : null;

  return {
    actualTotalQuantity,
    predictedTotalQuantity,
    meanAbsoluteQuantityError,
    reliability: classifyDateBacktestReliability(wape, evaluated.length),
    items: results.sort((a, b) => b.absoluteQuantityError - a.absoluteQuantityError),
  };
}

function buildRevenueBacktestSummaryForDate(
  date: string,
  data: RevenueForecastAccuracyView | undefined,
): RevenueBacktestDateSummary | null {
  const result = data?.dailyResults.find((day) => localIsoDate(day.date) === date);
  if (!result || result.actualRevenue <= 0) return null;

  return {
    actualRevenue: result.actualRevenue,
    predictedRevenue: result.predictedRevenue,
    absoluteWonError: result.absoluteWonError,
    weightedAbsolutePercentageError: result.weightedAbsolutePercentageError,
    reliability: classifyDateBacktestReliability(result.weightedAbsolutePercentageError, 1),
    bias: classifyRevenueBias(result.actualRevenue, result.predictedRevenue),
  };
}

function classifyRevenueBias(
  actualRevenue: number,
  predictedRevenue: number,
): RevenueBacktestDateSummary["bias"] {
  if (actualRevenue <= 0) return "insufficient_data";
  const ratio = predictedRevenue / actualRevenue;
  if (ratio >= 1.15) return "over";
  if (ratio <= 0.85) return "under";
  return "balanced";
}

function classifyDateBacktestReliability(
  weightedAbsolutePercentageError: number | null,
  evaluatedItemCount: number,
): MenuForecastAccuracyView["reliability"] {
  if (evaluatedItemCount === 0 || weightedAbsolutePercentageError === null) {
    return "insufficient_data";
  }
  if (weightedAbsolutePercentageError >= 0.8) return "low";
  if (weightedAbsolutePercentageError >= 0.35) return "watch";
  return "good";
}

const CONFIDENCE_LABEL: Record<CalendarMenuForecastSummary["confidenceLevel"], string> = {
  high: "예측 신뢰도 높음",
  medium: "예측 신뢰도 보통",
  low: "예측 신뢰도 낮음",
  collecting: "예측 데이터 수집 중",
};

const RELIABILITY_LABEL: Record<MenuForecastAccuracyView["reliability"], string> = {
  good: "신뢰도 좋음",
  watch: "주의",
  low: "신뢰도 낮음",
  insufficient_data: "데이터 부족",
};

const REVENUE_BIAS_LABEL: Record<RevenueBacktestDateSummary["bias"], string> = {
  over: "과대예측",
  under: "과소예측",
  balanced: "균형",
  insufficient_data: "데이터 부족",
};

function addDaysIso(date: Date, delta: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return localIsoDate(next);
}
