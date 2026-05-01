/**
 * 정기휴무 도메인 함수 (FR-040~045).
 *
 * - FR-041: 누락 카운트 / 푸시 / 재고 알림 제외
 * - FR-042: 소진 예측 요일별 평균 산정 제외
 * - FR-043: 캘린더 회색 표시 (이 모듈은 데이터, UI는 상위 레이어)
 * - FR-044: 변경은 변경 시점 이후부터 적용 — 과거 표시는 그 시점 규칙 유지
 * - FR-045: 정기휴무 요일에도 Sale 입력 시 정상 영업일 (예외 영업)
 */

import type { Database } from "@/lib/supabase/types";

export type Weekday = Database["public"]["Enums"]["weekday"];

// 7-tuple로 명시 → date.getDay()의 0-6 인덱스가 type-level에서 narrow됨.
// 이전엔 `if (!w) throw` 가드가 있었으나 getDay()가 항상 0-6을 반환해 불가능 분기였음.
const WEEKDAY_BY_INDEX = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const satisfies readonly [Weekday, Weekday, Weekday, Weekday, Weekday, Weekday, Weekday];

export function weekdayOf(date: Date): Weekday {
  return WEEKDAY_BY_INDEX[date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6];
}

export function isRegularDayOff(date: Date, daysOff: readonly Weekday[]): boolean {
  return daysOff.includes(weekdayOf(date));
}

export interface DailySample {
  date: Date;
  hasSale: boolean;
  value: number;
}

/**
 * FR-042: 평균 산정에서 정기휴무 요일을 제외한다.
 * FR-045: 정기휴무 요일이라도 Sale이 입력된 날은 예외 영업 → 평균에 포함.
 */
export function excludeFromAverage(
  samples: readonly DailySample[],
  daysOff: readonly Weekday[],
): DailySample[] {
  return samples.filter((s) => s.hasSale || !isRegularDayOff(s.date, daysOff));
}

/**
 * FR-041: 누락(영업일인데 sale 없음) 판정.
 * 정기휴무는 영업일이 아니므로 누락이 아니다. 단, Sale이 있으면 예외 영업으로 영업일 취급.
 */
export function isMissingDay(sample: DailySample, daysOff: readonly Weekday[]): boolean {
  if (sample.hasSale) return false;
  return !isRegularDayOff(sample.date, daysOff);
}

export interface DaysOffChange {
  effectiveFrom: Date;
  daysOff: readonly Weekday[];
}

/**
 * FR-044: 과거 어떤 날의 정기휴무 규칙을 알아내려면, 그 날짜에 활성이었던 변경을 찾는다.
 * `changes`는 시간 오름차순. 가장 최근에 effectiveFrom <= date인 항목의 daysOff가 적용 규칙.
 * 일치하는 변경이 없으면(가입 직후 날짜 등) 빈 배열로 가정 — 365일 영업.
 */
export function applyChangeSnapshot(
  date: Date,
  changes: readonly DaysOffChange[],
): readonly Weekday[] {
  const t = date.getTime();
  return changes.findLast((c) => c.effectiveFrom.getTime() <= t)?.daysOff ?? [];
}
