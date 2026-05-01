/**
 * 메뉴 마진율 → tone key. 디자인 시스템 components.md 임계값 (50%+ green / 30~49% amber / <30% red).
 * 기준 변경 시 이 한 곳만. 각 컴포넌트는 tone key를 own className에 매핑 (chip vs text 등).
 */

export type MarginTone = "green" | "amber" | "red";

export function marginTone(rate: number): MarginTone {
  if (rate >= 50) return "green";
  if (rate >= 30) return "amber";
  return "red";
}
