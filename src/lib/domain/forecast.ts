import { Decimal } from "./_decimal";
import { isRegularDayOff, weekdayOf, type Weekday } from "./regular-days-off";

/**
 * 재료 소진 예측 (FR-012/013/018/025/042).
 *
 * 입력: 재료의 일별 소비량 + 정기휴무 + 가입일.
 * 출력: 예상 소진일 + status + trend + 콜드스타트 여부.
 *
 * 핵심 로직:
 *  1. 콜드스타트 (가입 < 7일) → 모든 항목 isColdStart=true, 예측 안 함
 *     (정확히 7일 경계는 cold가 아님 — `tests/unit/forecast.test.ts` 참고)
 *  2. 요일별 가중 평균 산정 (정기휴무 제외)
 *  3. 오늘부터 일별 시뮬레이션 (정기휴무는 소비 0)
 *  4. 리드타임 + 안전여유일 설정값 차감해 status 분류
 *  5. trend는 7일 평균 vs 30일 평균 ±20% 비교
 */

const COLD_START_DAYS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FORECAST_DAYS = 365;
const TREND_THRESHOLD = 0.2;

export type DepletionStatus = "safe" | "caution" | "order_needed" | "critical";
export type ConsumptionTrend = "normal" | "rising" | "falling";

export interface DailyConsumption {
  date: Date;
  amount: number;
}

export interface ForecastInput {
  currentStock: number;
  leadTimeDays: number;
  safetyBufferDays: number;
  consumptionSamples: readonly DailyConsumption[];
  daysOff: readonly Weekday[];
  signupDate: Date;
  today: Date;
}

export interface ForecastResult {
  expectedDepletionDate: Date | null;
  status: DepletionStatus;
  trend: ConsumptionTrend;
  isColdStart: boolean;
}

export function isColdStart(signupDate: Date, today: Date): boolean {
  const elapsed = today.getTime() - signupDate.getTime();
  return elapsed < COLD_START_DAYS * ONE_DAY_MS;
}

/**
 * 정기휴무 제외한 요일별 평균 소비량.
 * 같은 요일의 sample들을 평균. 데이터 없는 요일은 Map에 키 없음 (호출 측 default 0).
 */
export function computeWeekdayUsageAverage(
  samples: readonly DailyConsumption[],
  daysOff: readonly Weekday[],
): Map<Weekday, Decimal> {
  const buckets = new Map<Weekday, { sum: Decimal; count: number }>();
  for (const s of samples) {
    if (isRegularDayOff(s.date, daysOff)) continue;
    const wk = weekdayOf(s.date);
    const bucket = buckets.get(wk) ?? { sum: new Decimal(0), count: 0 };
    bucket.sum = bucket.sum.plus(s.amount);
    bucket.count += 1;
    buckets.set(wk, bucket);
  }
  const avg = new Map<Weekday, Decimal>();
  for (const [wk, { sum, count }] of buckets) {
    avg.set(wk, count === 0 ? new Decimal(0) : sum.dividedBy(count));
  }
  return avg;
}

/**
 * 오늘부터 하루씩 시뮬레이션. 정기휴무는 소비 0.
 * 1년 내 소진 안 하면 null (충분히 여유).
 *
 * 데이터 없는 요일은 영업일 평균으로 대체. 그렇지 않으면 가입 직후·드문 영업
 * 요일에 over-forecast (실제보다 오래 버틴다고 잘못 안내) 위험.
 */
export function predictDepletionDate({
  currentStock,
  weekdayAvg,
  today,
  daysOff,
}: {
  currentStock: number;
  weekdayAvg: ReadonlyMap<Weekday, Decimal>;
  today: Date;
  daysOff: readonly Weekday[];
}): Date | null {
  let stock = new Decimal(currentStock);
  const fallback = overallWeekdayAverage(weekdayAvg);

  for (let offset = 1; offset <= MAX_FORECAST_DAYS; offset++) {
    const day = new Date(today.getTime() + offset * ONE_DAY_MS);
    if (isRegularDayOff(day, daysOff)) continue;

    const usage = weekdayAvg.get(weekdayOf(day)) ?? fallback;
    if (usage.isZero()) continue; // 전체 데이터가 0 → 소비 미정, 패스

    stock = stock.minus(usage);
    if (stock.isNegative() || stock.isZero()) return day;
  }
  return null;
}

function overallWeekdayAverage(weekdayAvg: ReadonlyMap<Weekday, Decimal>): Decimal {
  if (weekdayAvg.size === 0) return new Decimal(0);
  let sum = new Decimal(0);
  for (const v of weekdayAvg.values()) sum = sum.plus(v);
  return sum.dividedBy(weekdayAvg.size);
}

/**
 * 리드타임 + 안전여유일을 빼고 남은 buffer일 수로 status 분류 (FR-013).
 * - buffer ≤ 1: critical (당일/익일 소진 임박)
 * - buffer == 2: order_needed (지금 발주해야)
 * - buffer 3~4: caution
 * - buffer ≥ 5: safe
 *
 * 데이터 부족(depletionDate=null)은 safe.
 */
export function classifyStatus(
  depletionDate: Date | null,
  leadTimeDays: number,
  safetyBufferDays: number,
  today: Date,
): DepletionStatus {
  if (!depletionDate) return "safe";

  const daysUntilDepletion = Math.max(
    0,
    Math.floor((depletionDate.getTime() - today.getTime()) / ONE_DAY_MS),
  );
  const buffer = daysUntilDepletion - leadTimeDays - safetyBufferDays;

  if (buffer <= 1) return "critical";
  if (buffer === 2) return "order_needed";
  if (buffer <= 4) return "caution";
  return "safe";
}

/**
 * 7일 평균 vs 30일 평균. ±20% 이상이면 rising/falling.
 * 데이터 부족 (30일 평균 0) → normal.
 *
 * 30일 미만 sample이면 분모가 30 고정이라 평균이 희석됨 — 호출 측이
 * `isColdStart` 게이트로 가입 7일 이내를 차단한다는 가정 (forecastIngredient는
 * 그렇게 함). 단독 호출 시 결과 해석에 주의.
 */
export function detectTrend(samples: readonly DailyConsumption[], today: Date): ConsumptionTrend {
  const last7Avg = averageOverDays(samples, today, 7);
  const last30Avg = averageOverDays(samples, today, 30);

  if (last30Avg.isZero()) return "normal";
  const ratio = last7Avg.dividedBy(last30Avg).toNumber();
  if (ratio > 1 + TREND_THRESHOLD) return "rising";
  if (ratio < 1 - TREND_THRESHOLD) return "falling";
  return "normal";
}

function averageOverDays(
  samples: readonly DailyConsumption[],
  today: Date,
  windowDays: number,
): Decimal {
  const cutoff = today.getTime() - windowDays * ONE_DAY_MS;
  const inWindow = samples.filter((s) => s.date.getTime() >= cutoff);
  if (inWindow.length === 0) return new Decimal(0);
  const sum = inWindow.reduce((acc, s) => acc.plus(s.amount), new Decimal(0));
  return sum.dividedBy(windowDays);
}

/**
 * 한 재료의 예측 합성 함수 — 호출 측 (UI / RPC) 진입점.
 */
export function forecastIngredient(input: ForecastInput): ForecastResult {
  if (isColdStart(input.signupDate, input.today)) {
    return {
      expectedDepletionDate: null,
      status: "safe",
      trend: "normal",
      isColdStart: true,
    };
  }

  const weekdayAvg = computeWeekdayUsageAverage(input.consumptionSamples, input.daysOff);
  const depletionDate = predictDepletionDate({
    currentStock: input.currentStock,
    weekdayAvg,
    today: input.today,
    daysOff: input.daysOff,
  });

  return {
    expectedDepletionDate: depletionDate,
    status: classifyStatus(depletionDate, input.leadTimeDays, input.safetyBufferDays, input.today),
    trend: detectTrend(input.consumptionSamples, input.today),
    isColdStart: false,
  };
}
