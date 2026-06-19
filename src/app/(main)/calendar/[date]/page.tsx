"use client";

import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { useParams } from "next/navigation";
import { useCalendarMonth } from "@/features/calendar/hooks/useCalendarMonth";
import { useMenuDemandForecast } from "@/features/inventory/hooks/useMenuDemandForecast";
import { useSaleByDate, type SaleWithItems } from "@/features/sale/hooks/useSaleByDate";
import {
  buildCalendarMenuForecastByDate,
  type CalendarMenuForecastSummary,
} from "@/features/calendar/lib/menu-forecast-calendar";
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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function CalendarDateDetailPage(): React.ReactElement {
  const params = useParams<{ date: string }>();
  const date = params.date;
  const parsedDate = DATE_PATTERN.test(date) ? parseLocalDateFromIso(date) : null;
  const year = parsedDate?.getFullYear() ?? null;
  const month = parsedDate ? parsedDate.getMonth() + 1 : null;
  const todayIso = useTodayIso();
  const today = todayIso ? (parseLocalDateFromIso(todayIso) ?? new Date()) : new Date();
  const isFutureDate = parsedDate ? differenceInCalendarDays(parsedDate, today) > 0 : false;
  const forecastHorizonDays = parsedDate
    ? Math.min(365, Math.max(7, differenceInCalendarDays(parsedDate, today) + 1))
    : 7;
  const calendarQuery = useCalendarMonth(year, month);
  const saleQuery = useSaleByDate(date);
  const menuForecastQuery = useMenuDemandForecast(forecastHorizonDays);

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
          todayIso={todayIso}
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
  todayIso: string;
}

function DateDetailBody({
  cell,
  date,
  parsedDate,
  sale,
  menuForecast,
  todayIso,
}: DateDetailBodyProps): React.ReactElement {
  const today = parseLocalDateFromIso(todayIso) ?? new Date();
  const daysFromToday = differenceInCalendarDays(parsedDate, today);

  if (cell?.isFuture) {
    return <FutureForecastDetail date={date} forecast={menuForecast} />;
  }
  if (cell?.isBeforeSignup) {
    return <Notice tone="neutral">가입 전 데이터예요.</Notice>;
  }
  if (cell?.isRegularDayOff) {
    return <Notice tone="neutral">정기휴무일이에요.</Notice>;
  }
  if (sale) {
    return <ExistingSaleDetail sale={sale} hasPurchase={cell?.hasPurchase ?? false} />;
  }
  return <MissingSaleDetail date={date} daysFromToday={daysFromToday} />;
}

function FutureForecastDetail({
  date,
  forecast,
}: {
  date: string;
  forecast: CalendarMenuForecastSummary | null;
}): React.ReactElement {
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
            미래 날짜는 판매 입력은 막고, 현재까지의 판매 이력으로 계산한 예측만 보여줘요.
          </Notice>
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

interface ExistingSaleDetailProps {
  sale: SaleWithItems;
  hasPurchase: boolean;
}

function ExistingSaleDetail({ sale, hasPurchase }: ExistingSaleDetailProps): React.ReactElement {
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
    </div>
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

function addDaysIso(date: Date, delta: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return localIsoDate(next);
}
