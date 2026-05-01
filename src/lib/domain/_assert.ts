/**
 * 도메인 invariants 가드.
 *
 * 내부 도메인 함수에서만 사용 — I/O 경계는 Zod schema가 담당.
 * 메시지 포맷이 일관되어야 추후 i18n 전환 시 검색·치환이 쉬움.
 */

export function assertNonNegative(value: number, label: string): void {
  // `NaN < 0` is false → without an explicit guard, NaN slips through and
  // contaminates Decimal arithmetic downstream.
  if (Number.isNaN(value)) {
    throw new Error(`${label} must be a number (got NaN)`);
  }
  if (value < 0) {
    throw new Error(`${label} must be non-negative (got ${value})`);
  }
}
