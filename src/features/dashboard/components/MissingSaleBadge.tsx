"use client";

import Link from "next/link";

interface MissingSaleBadgeProps {
  yesterdaySoldAt: string;
}

/**
 * 어제 판매 미입력 알림 배지 (FR-091).
 * 홈 헤더 옆 또는 하단에 배치 — AlertsCard의 입력 알림과 별개로 시각적 강조.
 */
export function MissingSaleBadge({ yesterdaySoldAt }: MissingSaleBadgeProps): React.ReactElement {
  return (
    <Link
      href={`/sale/${yesterdaySoldAt}`}
      aria-label="어제 판매 미입력 — 입력하러 가기"
      className="inline-flex items-center gap-1 rounded-full bg-red px-2 py-0.5 text-micro text-bg"
    >
      <span aria-hidden>●</span>
      어제 판매 미입력
    </Link>
  );
}
