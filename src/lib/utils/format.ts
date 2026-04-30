/**
 * 한국어 화폐 / 숫자 포맷 유틸.
 * 도메인 함수는 Decimal로 정밀도 보존, UI 표시 직전에 이 헬퍼로 변환.
 */

export function formatWon(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

export function formatNumber(value: number): string {
  return value.toLocaleString("ko-KR");
}
