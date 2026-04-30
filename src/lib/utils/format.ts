/**
 * 한국어 화폐 / 숫자 / 날짜 포맷 유틸.
 * 도메인 함수는 Decimal로 정밀도 보존, UI 표시 직전에 이 헬퍼로 변환.
 */

import { differenceInCalendarDays } from "date-fns";

export function formatWon(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

export function formatNumber(value: number): string {
  return value.toLocaleString("ko-KR");
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * "YYYY-MM-DD" 문자열을 한국어 한 글자 요일로 변환.
 * timezone 해석 회피 위해 date 부품을 직접 분해 (Date 생성자에 ISO 문자열 + Z 패스
 * 사용 시 호스트 tz에 따라 ±1일 오차 가능).
 */
export function weekdayKoFromIso(iso: string): string {
  const parts = iso.split("-").map(Number);
  const [y, m, d] = parts;
  if (y === undefined || m === undefined || d === undefined) return "";
  return WEEKDAY_KO[new Date(y, m - 1, d).getDay()] ?? "";
}

/**
 * 오늘 날짜를 "M월 D일 (요일)" 한국어 라벨로 반환.
 * 클라이언트에서만 호출 — `new Date()`가 SSR/CSR 경계에서 다른 시각이 될 수 있어
 * 서버 렌더링 본문에 직접 박지 말 것 (useEffect 또는 useState lazy init 권장).
 */
export function formatTodayKo(now: Date = new Date()): string {
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const day = WEEKDAY_KO[now.getDay()];
  return `${month}월 ${date}일 (${day})`;
}

/**
 * 예상 소진일까지 캘린더 일수 (오늘 기준). 시계 시각이 아니라 0시 기준 day diff —
 * 23:59 vs 00:00 같은 날 안 차이가 1일로 잘못 보고되는 off-by-one 차단.
 * `expectedDepletionDate`이 null이면 null 반환 (호출 측에서 "예측 부족" 처리).
 */
export function daysUntilDate(target: Date | null, now: Date = new Date()): number | null {
  if (!target) return null;
  return Math.max(0, differenceInCalendarDays(target, now));
}
