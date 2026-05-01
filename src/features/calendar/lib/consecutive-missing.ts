import type { CalendarCell } from "@/lib/supabase/rpc";

/**
 * RPC가 반환한 날짜순 셀 배열에 `consecutiveMissingDays` 필드를 추가.
 * - 해당 셀이 누락이면: 직전까지의 연속 누락일 수 + 1
 * - 누락 아니면 0 (런 종료)
 *
 * 헌법 IV: 사용자별 데이터이므로 RPC가 user_id 격리 — 이 함수는 순수 변환.
 * SQL window 함수 대신 단순 reduce로 처리해 SQL 복잡도 감소.
 */
export interface EnrichedCalendarCell extends CalendarCell {
  consecutiveMissingDays: number;
}

export function withConsecutiveMissingDays(cells: readonly CalendarCell[]): EnrichedCalendarCell[] {
  let counter = 0;
  return cells.map((cell) => {
    counter = cell.isMissing ? counter + 1 : 0;
    return { ...cell, consecutiveMissingDays: counter };
  });
}
