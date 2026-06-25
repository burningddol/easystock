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
 *  2. 영업일 타입별 + 개별요일 최근가중 평균 산정 (정기휴무 제외)
 *     - weekday: 월~목
 *     - friday: 금
 *     - weekend: 토~일
 *     - 표본 부족 그룹은 전체 영업일 평균으로 shrinkage
 *     - 개별요일 표본이 쌓이면 그룹 평균을 anchor로 최대 85%까지 점진 반영
 *  3. 오늘부터 일별 시뮬레이션 (정기휴무는 소비 0)
 *  4. 리드타임 + 안전여유일 설정값 차감해 status 분류
 *  5. trend는 7일 평균 vs 30일 평균 ±20% 비교, 소진일에는 완만한 계수만 반영
 */

const COLD_START_DAYS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FORECAST_DAYS = 365;
const TREND_THRESHOLD = 0.2;
const DEFAULT_RECENCY_DECAY_DAYS = 14;
const DEFAULT_MIN_GROUP_SAMPLE_SIZE = 8;
const DEFAULT_OUTLIER_CAP_MULTIPLIER = 3;
const TREND_FACTOR_MIN = 0.85;
const TREND_FACTOR_MAX = 1.25;

export type DepletionStatus = "safe" | "caution" | "order_needed" | "critical";
export type ConsumptionTrend = "normal" | "rising" | "falling";
export type BusinessDayType = "weekday" | "friday" | "weekend";
export type ForecastSensitivity = "stable" | "balanced" | "responsive";
export type ForecastConfidenceLevel = "high" | "medium" | "low" | "collecting";

export interface ForecastTuning {
  recencyDecayDays: number;
  minGroupSampleSize: number;
  weekdayPriorStrength: number;
  maxWeekdayConfidence: number;
  outlierCapMultiplier: number;
}

export const FORECAST_TUNING_PRESETS: Record<ForecastSensitivity, ForecastTuning> = {
  stable: {
    recencyDecayDays: 21,
    minGroupSampleSize: 12,
    weekdayPriorStrength: 16,
    maxWeekdayConfidence: 0.85,
    outlierCapMultiplier: 2.5,
  },
  balanced: {
    recencyDecayDays: DEFAULT_RECENCY_DECAY_DAYS,
    minGroupSampleSize: DEFAULT_MIN_GROUP_SAMPLE_SIZE,
    weekdayPriorStrength: 12,
    maxWeekdayConfidence: 0.85,
    outlierCapMultiplier: DEFAULT_OUTLIER_CAP_MULTIPLIER,
  },
  responsive: {
    recencyDecayDays: 7,
    minGroupSampleSize: 5,
    weekdayPriorStrength: 8,
    maxWeekdayConfidence: 0.85,
    outlierCapMultiplier: 4,
  },
};

export interface DailyConsumption {
  date: Date;
  amount: number;
}

export interface DailyMenuDemand {
  date: Date;
  quantity: number;
}

export interface MenuRecipeIngredient {
  ingredientId: string;
  quantityPerServing: number;
}

export interface MenuOptionRecipeIngredient {
  ingredientId: string;
  quantityPerSelection: number;
}

export interface MenuOptionValueForecastInput {
  optionValueId: string;
  name: string;
  isDefault: boolean;
  selectionRate: number;
  recipe: readonly MenuOptionRecipeIngredient[];
}

export interface MenuOptionGroupForecastInput {
  optionGroupId: string;
  name: string;
  selectionType: "single" | "add_on";
  isRequired: boolean;
  values: readonly MenuOptionValueForecastInput[];
}

export interface MenuIngredientDemandForecastInput {
  menuId: string;
  name: string;
  baseRecipe: readonly MenuRecipeIngredient[];
  optionGroups: readonly MenuOptionGroupForecastInput[];
  demandForecast: MenuDemandForecastResult;
}

export interface IngredientDemandForecastDay {
  date: Date;
  amount: number;
}

export interface IngredientDemandForecast {
  ingredientId: string;
  dailyPredictions: IngredientDemandForecastDay[];
}

export interface ForecastInput {
  currentStock: number;
  leadTimeDays: number;
  safetyBufferDays: number;
  consumptionSamples: readonly DailyConsumption[];
  daysOff: readonly Weekday[];
  signupDate: Date;
  today: Date;
  sensitivity?: ForecastSensitivity;
}

export interface ForecastResult {
  expectedDepletionDate: Date | null;
  status: DepletionStatus;
  trend: ConsumptionTrend;
  isColdStart: boolean;
  basis: ForecastBasis;
}

export interface ForecastBasis {
  model: "hierarchical_weekday";
  usableSampleCount: number;
  averageWeekdayConfidence: number;
  maxWeekdayConfidence: number;
  confidenceLevel: ForecastConfidenceLevel;
}

export interface PurchaseRecommendationInput {
  currentStock: number;
  leadTimeDays: number;
  safetyBufferDays: number;
  dailyDemand: readonly IngredientDemandForecastDay[];
  today: Date;
  coverageDays?: number;
}

export interface PurchaseRecommendationResult {
  recommendedOrderQuantity: number;
  targetDemandQuantity: number;
  depletionWindowDemandQuantity: number;
  orderByDate: Date | null;
  targetCoverageDays: number;
  isOrderRecommended: boolean;
}

export interface MenuDemandForecastInput {
  demandSamples: readonly DailyMenuDemand[];
  daysOff: readonly Weekday[];
  signupDate: Date;
  today: Date;
  horizonDays?: number;
  sensitivity?: ForecastSensitivity;
}

export interface MenuDemandForecastDay {
  date: Date;
  dayType: BusinessDayType | null;
  predictedQuantity: number;
}

export interface MenuDemandForecastResult {
  dailyPredictions: MenuDemandForecastDay[];
  fallbackDailyQuantity: number;
  trend: ConsumptionTrend;
  isColdStart: boolean;
  basis: ForecastBasis;
}

export interface UsageForecastModel {
  usageByDayType: ReadonlyMap<BusinessDayType, Decimal>;
  usageByWeekday: ReadonlyMap<Weekday, Decimal>;
  fallbackDailyUsage: Decimal;
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
 * 영업일 타입 분류.
 *
 * 빙수집/카페류는 요일 7개를 모두 쪼개면 최근 90일이어도 요일당 표본이 작아
 * 노이즈가 커진다. MVP 운영 예측은 평일/금요일/주말 단위가 더 안정적이다.
 */
export function businessDayTypeOf(date: Date, daysOff: readonly Weekday[]): BusinessDayType | null {
  if (isRegularDayOff(date, daysOff)) return null;

  const weekday = weekdayOf(date);
  if (weekday === "FRI") return "friday";
  if (weekday === "SAT" || weekday === "SUN") return "weekend";
  return "weekday";
}

/**
 * 영업일 타입별 + 개별요일 최근가중 평균 소비량.
 *
 * - 최근 sample일수록 exp(-daysAgo / 14)로 더 크게 반영
 * - 단체주문 같은 극단값은 중앙값의 3배로 cap
 * - 그룹 표본이 8개 미만이면 전체 영업일 평균과 섞어 안정화
 * - 개별요일 표본은 count / (count + prior)로 그룹 평균과 섞어 점진 반영
 */
export function computeBusinessDayUsageModel(
  samples: readonly DailyConsumption[],
  daysOff: readonly Weekday[],
  today: Date,
  sensitivity: ForecastSensitivity = "balanced",
): UsageForecastModel {
  const tuning = FORECAST_TUNING_PRESETS[sensitivity];
  const usableSamples = samples
    .filter((sample) => !isRegularDayOff(sample.date, daysOff) && sample.amount > 0)
    .map((sample) => ({
      ...sample,
      amount: capOutlier(sample.amount, samples, tuning.outlierCapMultiplier),
      dayType: businessDayTypeOf(sample.date, daysOff),
      weight: recencyWeight(sample.date, today, tuning.recencyDecayDays),
    }))
    .filter((sample): sample is DailyConsumption & { dayType: BusinessDayType; weight: number } =>
      Boolean(sample.dayType),
    );

  if (usableSamples.length === 0) {
    return {
      usageByDayType: new Map(),
      usageByWeekday: new Map(),
      fallbackDailyUsage: new Decimal(0),
    };
  }

  const globalAverage = weightedAverage(
    usableSamples.map((sample) => ({ amount: sample.amount, weight: sample.weight })),
  );
  const buckets = new Map<
    BusinessDayType,
    { weightedSum: Decimal; weightSum: Decimal; count: number }
  >();
  const weekdayBuckets = new Map<
    Weekday,
    { weightedSum: Decimal; weightSum: Decimal; count: number; dayType: BusinessDayType }
  >();

  for (const sample of usableSamples) {
    const bucket = buckets.get(sample.dayType) ?? {
      weightedSum: new Decimal(0),
      weightSum: new Decimal(0),
      count: 0,
    };
    const weight = new Decimal(sample.weight);
    bucket.weightedSum = bucket.weightedSum.plus(new Decimal(sample.amount).times(weight));
    bucket.weightSum = bucket.weightSum.plus(weight);
    bucket.count += 1;
    buckets.set(sample.dayType, bucket);

    const weekday = weekdayOf(sample.date);
    const weekdayBucket = weekdayBuckets.get(weekday) ?? {
      weightedSum: new Decimal(0),
      weightSum: new Decimal(0),
      count: 0,
      dayType: sample.dayType,
    };
    weekdayBucket.weightedSum = weekdayBucket.weightedSum.plus(
      new Decimal(sample.amount).times(weight),
    );
    weekdayBucket.weightSum = weekdayBucket.weightSum.plus(weight);
    weekdayBucket.count += 1;
    weekdayBuckets.set(weekday, weekdayBucket);
  }

  const usageByDayType = new Map<BusinessDayType, Decimal>();
  for (const [dayType, bucket] of buckets) {
    const groupAverage = bucket.weightSum.isZero()
      ? globalAverage
      : bucket.weightedSum.dividedBy(bucket.weightSum);
    const confidence = Math.min(bucket.count / tuning.minGroupSampleSize, 1);
    const stabilized = groupAverage.times(confidence).plus(globalAverage.times(1 - confidence));
    usageByDayType.set(dayType, stabilized);
  }
  const usageByWeekday = new Map<Weekday, Decimal>();
  for (const [weekday, bucket] of weekdayBuckets) {
    const weekdayAverage = bucket.weightSum.isZero()
      ? (usageByDayType.get(bucket.dayType) ?? globalAverage)
      : bucket.weightedSum.dividedBy(bucket.weightSum);
    const groupAnchor = usageByDayType.get(bucket.dayType) ?? globalAverage;
    const confidence = Math.min(
      bucket.count / (bucket.count + tuning.weekdayPriorStrength),
      tuning.maxWeekdayConfidence,
    );
    const stabilized = weekdayAverage.times(confidence).plus(groupAnchor.times(1 - confidence));
    usageByWeekday.set(weekday, stabilized);
  }

  return {
    usageByDayType,
    usageByWeekday,
    fallbackDailyUsage: globalAverage,
  };
}

function recencyWeight(date: Date, today: Date, decayDays: number): number {
  const daysAgo = Math.max(0, (today.getTime() - date.getTime()) / ONE_DAY_MS);
  return Math.exp(-daysAgo / decayDays);
}

function capOutlier(
  amount: number,
  samples: readonly DailyConsumption[],
  capMultiplier: number,
): number {
  const positiveAmounts = samples
    .map((sample) => sample.amount)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  if (positiveAmounts.length === 0) return amount;

  const median = positiveAmounts[Math.floor(positiveAmounts.length / 2)];
  if (!median || median <= 0) return amount;
  return Math.min(amount, median * capMultiplier);
}

function weightedAverage(samples: readonly { amount: number; weight: number }[]): Decimal {
  const totals = samples.reduce(
    (acc, sample) => {
      const weight = new Decimal(sample.weight);
      return {
        weightedSum: acc.weightedSum.plus(new Decimal(sample.amount).times(weight)),
        weightSum: acc.weightSum.plus(weight),
      };
    },
    { weightedSum: new Decimal(0), weightSum: new Decimal(0) },
  );

  if (totals.weightSum.isZero()) return new Decimal(0);
  return totals.weightedSum.dividedBy(totals.weightSum);
}

/**
 * 오늘부터 하루씩 시뮬레이션. 정기휴무는 소비 0.
 * 1년 내 소진 안 하면 null (충분히 여유).
 *
 * 데이터 없는 영업일 타입은 전체 영업일 평균으로 대체. 그렇지 않으면 가입 직후·
 * 드문 영업 타입에 over-forecast (실제보다 오래 버틴다고 잘못 안내) 위험.
 */
export function predictDepletionDate({
  currentStock,
  usageModel,
  trendFactor = 1,
  today,
  daysOff,
}: {
  currentStock: number;
  usageModel: UsageForecastModel;
  trendFactor?: number;
  today: Date;
  daysOff: readonly Weekday[];
}): Date | null {
  let stock = new Decimal(currentStock);
  const trendMultiplier = new Decimal(clamp(trendFactor, TREND_FACTOR_MIN, TREND_FACTOR_MAX));

  for (let offset = 1; offset <= MAX_FORECAST_DAYS; offset++) {
    const day = new Date(today.getTime() + offset * ONE_DAY_MS);
    const dayType = businessDayTypeOf(day, daysOff);
    if (!dayType) continue;

    const usage = (
      usageModel.usageByWeekday.get(weekdayOf(day)) ??
      usageModel.usageByDayType.get(dayType) ??
      usageModel.fallbackDailyUsage
    ).times(trendMultiplier);
    if (usage.isZero()) continue; // 전체 데이터가 0 → 소비 미정, 패스

    stock = stock.minus(usage);
    if (stock.isNegative() || stock.isZero()) return day;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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

  const daysUntilDepletion = Math.max(0, daysBetweenForecastDays(today, depletionDate));
  const buffer = daysUntilDepletion - leadTimeDays - safetyBufferDays;

  if (buffer <= 1) return "critical";
  if (buffer === 2) return "order_needed";
  if (buffer <= 4) return "caution";
  return "safe";
}

/**
 * 발주 추천량.
 *
 * 발주 시점은 `리드타임 + 안전여유`로 판단하고, 권장 수량은 목표 운영일수만큼의
 * 예상 소요량으로 추천한다. 기본 목표 커버리지는 7일이다.
 */
export function recommendPurchaseQuantity({
  currentStock,
  leadTimeDays,
  safetyBufferDays,
  dailyDemand,
  today,
  coverageDays = 7,
}: PurchaseRecommendationInput): PurchaseRecommendationResult {
  const targetCoverageDays = Math.max(1, Math.ceil(coverageDays));
  const normalizedToday = startOfForecastDay(today);
  const demandByDay = dailyDemand
    .filter((day) => startOfForecastDay(day.date).getTime() > normalizedToday.getTime())
    .sort((a, b) => startOfForecastDay(a.date).getTime() - startOfForecastDay(b.date).getTime());

  const targetDemand = demandByDay
    .slice(0, targetCoverageDays)
    .reduce((sum, day) => sum + Math.max(0, day.amount), 0);
  const orderByDate = computeOrderByDate({
    currentStock,
    leadTimeDays,
    safetyBufferDays,
    dailyDemand: demandByDay,
    today: normalizedToday,
  });
  const daysToDepletion = computeDaysToDepletion({
    currentStock,
    dailyDemand: demandByDay,
  });
  const recommendedOrderQuantity = orderByDate === null ? 0 : targetDemand;
  const depletionWindowDemand =
    daysToDepletion === null
      ? 0
      : demandByDay
          .slice(0, daysToDepletion)
          .reduce((sum, day) => sum + Math.max(0, day.amount), 0);

  return {
    recommendedOrderQuantity,
    targetDemandQuantity: targetDemand,
    depletionWindowDemandQuantity: depletionWindowDemand,
    orderByDate,
    targetCoverageDays,
    isOrderRecommended: recommendedOrderQuantity > 0,
  };
}

function computeDaysToDepletion({
  currentStock,
  dailyDemand,
}: {
  currentStock: number;
  dailyDemand: readonly IngredientDemandForecastDay[];
}): number | null {
  if (currentStock <= 0) return 0;
  let remaining = currentStock;
  for (let index = 0; index < dailyDemand.length; index += 1) {
    remaining -= Math.max(0, dailyDemand[index]?.amount ?? 0);
    if (remaining <= 0) return index + 1;
  }
  return null;
}

function computeOrderByDate({
  currentStock,
  leadTimeDays,
  safetyBufferDays,
  dailyDemand,
  today,
}: {
  currentStock: number;
  leadTimeDays: number;
  safetyBufferDays: number;
  dailyDemand: readonly IngredientDemandForecastDay[];
  today: Date;
}): Date | null {
  let stock = currentStock;
  for (const day of dailyDemand) {
    stock -= Math.max(0, day.amount);
    if (stock <= 0) {
      const orderBy = new Date(startOfForecastDay(day.date));
      orderBy.setDate(orderBy.getDate() - Math.max(0, Math.ceil(leadTimeDays)) - safetyBufferDays);
      return orderBy.getTime() < today.getTime() ? today : orderBy;
    }
  }
  return null;
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

export function computeTrendFactor(samples: readonly DailyConsumption[], today: Date): number {
  const last7Avg = averageOverDays(samples, today, 7);
  const last30Avg = averageOverDays(samples, today, 30);

  if (last30Avg.isZero()) return 1;
  return clamp(last7Avg.dividedBy(last30Avg).toNumber(), TREND_FACTOR_MIN, TREND_FACTOR_MAX);
}

export function computeForecastBasis(
  samples: readonly DailyConsumption[],
  daysOff: readonly Weekday[],
  sensitivity: ForecastSensitivity = "balanced",
): ForecastBasis {
  const tuning = FORECAST_TUNING_PRESETS[sensitivity];
  const weekdayCounts = new Map<Weekday, number>();
  let usableSampleCount = 0;

  for (const sample of samples) {
    if (sample.amount <= 0 || isRegularDayOff(sample.date, daysOff)) continue;
    usableSampleCount += 1;
    const weekday = weekdayOf(sample.date);
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
  }

  const confidences = Array.from(weekdayCounts.values()).map((count) =>
    Math.min(count / (count + tuning.weekdayPriorStrength), tuning.maxWeekdayConfidence),
  );
  const averageWeekdayConfidence =
    confidences.length > 0
      ? confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length
      : 0;
  const maxWeekdayConfidence =
    confidences.length > 0 ? Math.max(...confidences) : tuning.maxWeekdayConfidence;

  return {
    model: "hierarchical_weekday",
    usableSampleCount,
    averageWeekdayConfidence,
    maxWeekdayConfidence,
    confidenceLevel: classifyForecastConfidence(usableSampleCount, averageWeekdayConfidence),
  };
}

function classifyForecastConfidence(
  usableSampleCount: number,
  averageWeekdayConfidence: number,
): ForecastConfidenceLevel {
  if (usableSampleCount < COLD_START_DAYS) return "collecting";
  if (usableSampleCount < 14 || averageWeekdayConfidence < 0.35) return "low";
  if (usableSampleCount < 30 || averageWeekdayConfidence < 0.65) return "medium";
  return "high";
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
  const basis = computeForecastBasis(input.consumptionSamples, input.daysOff, input.sensitivity);
  if (isColdStart(input.signupDate, input.today)) {
    return {
      expectedDepletionDate: null,
      status: "safe",
      trend: "normal",
      isColdStart: true,
      basis,
    };
  }

  const trend = detectTrend(input.consumptionSamples, input.today);
  const usageModel = computeBusinessDayUsageModel(
    input.consumptionSamples,
    input.daysOff,
    input.today,
    input.sensitivity,
  );
  const depletionDate = predictDepletionDate({
    currentStock: input.currentStock,
    usageModel,
    trendFactor: computeTrendFactor(input.consumptionSamples, input.today),
    today: input.today,
    daysOff: input.daysOff,
  });

  return {
    expectedDepletionDate: depletionDate,
    status: classifyStatus(depletionDate, input.leadTimeDays, input.safetyBufferDays, input.today),
    trend,
    isColdStart: false,
    basis,
  };
}

/**
 * 메뉴별 수요 예측.
 *
 * 재료 예측과 같은 영업일 타입/최근가중/추세 모델을 사용하되, 값의 단위만
 * 재료 사용량이 아니라 메뉴 판매 수량이다. 옵션 선택률은 다음 단계에서 별도
 * modifier attach-rate 모델로 곱한다.
 */
export function forecastMenuDemand(input: MenuDemandForecastInput): MenuDemandForecastResult {
  const horizonDays = input.horizonDays ?? 7;
  const consumptionLikeSamples = input.demandSamples.map((sample) => ({
    date: sample.date,
    amount: sample.quantity,
  }));
  const basis = computeForecastBasis(consumptionLikeSamples, input.daysOff, input.sensitivity);
  if (isColdStart(input.signupDate, input.today)) {
    return {
      dailyPredictions: buildZeroMenuDemandDays(input.today, horizonDays, input.daysOff),
      fallbackDailyQuantity: 0,
      trend: "normal",
      isColdStart: true,
      basis,
    };
  }

  const model = computeBusinessDayUsageModel(
    consumptionLikeSamples,
    input.daysOff,
    input.today,
    input.sensitivity,
  );
  const trendFactor = computeTrendFactor(consumptionLikeSamples, input.today);
  const trend = detectTrend(consumptionLikeSamples, input.today);
  const predictions: MenuDemandForecastDay[] = [];

  for (let offset = 1; offset <= horizonDays; offset++) {
    const date = new Date(input.today.getTime() + offset * ONE_DAY_MS);
    const dayType = businessDayTypeOf(date, input.daysOff);
    const predictedQuantity = dayType
      ? (
          model.usageByWeekday.get(weekdayOf(date)) ??
          model.usageByDayType.get(dayType) ??
          model.fallbackDailyUsage
        )
          .times(clamp(trendFactor, TREND_FACTOR_MIN, TREND_FACTOR_MAX))
          .toNumber()
      : 0;
    predictions.push({
      date,
      dayType,
      predictedQuantity,
    });
  }

  return {
    dailyPredictions: predictions,
    fallbackDailyQuantity: model.fallbackDailyUsage.toNumber(),
    trend,
    isColdStart: false,
    basis,
  };
}

function buildZeroMenuDemandDays(
  today: Date,
  horizonDays: number,
  daysOff: readonly Weekday[],
): MenuDemandForecastDay[] {
  return Array.from({ length: horizonDays }, (_, index) => {
    const date = new Date(today.getTime() + (index + 1) * ONE_DAY_MS);
    return {
      date,
      dayType: businessDayTypeOf(date, daysOff),
      predictedQuantity: 0,
    };
  });
}

export function forecastIngredientDemandFromMenus(
  menus: readonly MenuIngredientDemandForecastInput[],
): IngredientDemandForecast[] {
  const byIngredient = new Map<string, Map<number, { date: Date; amount: Decimal }>>();

  for (const menu of menus) {
    const normalizedGroups = menu.optionGroups.map((group) => ({
      ...group,
      values: withEffectiveOptionRates(group),
    }));

    for (const day of menu.demandForecast.dailyPredictions) {
      const menuQuantity = new Decimal(Math.max(0, day.predictedQuantity));
      if (menuQuantity.isZero()) continue;

      for (const recipeItem of menu.baseRecipe) {
        addIngredientDemand(
          byIngredient,
          recipeItem.ingredientId,
          day.date,
          menuQuantity.times(recipeItem.quantityPerServing),
        );
      }

      for (const group of normalizedGroups) {
        for (const value of group.values) {
          const optionQuantity = menuQuantity.times(value.effectiveRate);
          if (optionQuantity.isZero()) continue;

          for (const recipeItem of value.recipe) {
            addIngredientDemand(
              byIngredient,
              recipeItem.ingredientId,
              day.date,
              optionQuantity.times(recipeItem.quantityPerSelection),
            );
          }
        }
      }
    }
  }

  return Array.from(byIngredient.entries())
    .map(([ingredientId, daily]) => ({
      ingredientId,
      dailyPredictions: Array.from(daily.values())
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((day) => ({ date: day.date, amount: day.amount.toNumber() })),
    }))
    .sort((a, b) => a.ingredientId.localeCompare(b.ingredientId));
}

function withEffectiveOptionRates(
  group: MenuOptionGroupForecastInput,
): Array<MenuOptionValueForecastInput & { effectiveRate: number }> {
  if (group.selectionType === "add_on") {
    return group.values.map((value) => ({
      ...value,
      effectiveRate: Math.max(0, value.selectionRate),
    }));
  }

  const positiveTotal = group.values.reduce(
    (sum, value) => sum + Math.max(0, value.selectionRate),
    0,
  );
  if (positiveTotal > 0) {
    return group.values.map((value) => ({
      ...value,
      effectiveRate: Math.max(0, value.selectionRate) / positiveTotal,
    }));
  }

  const defaults = group.values.filter((value) => value.isDefault);
  return group.values.map((value) => ({
    ...value,
    effectiveRate:
      defaults.length > 0 && value.isDefault ? 1 / defaults.length : group.isRequired ? 0 : 0,
  }));
}

function addIngredientDemand(
  byIngredient: Map<string, Map<number, { date: Date; amount: Decimal }>>,
  ingredientId: string,
  date: Date,
  amount: Decimal,
): void {
  const dateKey = startOfForecastDay(date).getTime();
  const daily =
    byIngredient.get(ingredientId) ?? new Map<number, { date: Date; amount: Decimal }>();
  const existing = daily.get(dateKey);
  daily.set(dateKey, {
    date: existing?.date ?? new Date(dateKey),
    amount: (existing?.amount ?? new Decimal(0)).plus(amount),
  });
  byIngredient.set(ingredientId, daily);
}

function startOfForecastDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetweenForecastDays(from: Date, to: Date): number {
  return Math.floor(
    (startOfForecastDay(to).getTime() - startOfForecastDay(from).getTime()) / ONE_DAY_MS,
  );
}
