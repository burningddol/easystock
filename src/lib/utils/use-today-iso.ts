"use client";

import { useEffect, useState } from "react";

/**
 * 오늘 날짜 (YYYY-MM-DD)를 클라이언트 mount 후 한 번만 채움.
 * SSR과 CSR이 자정 경계를 사이에 두면 서로 다른 날짜를 렌더해 hydration mismatch.
 * 마운트 전에는 null — 호출 측이 null을 가드해야 함.
 */
export function useTodayIso(): string | null {
  const [iso, setIso] = useState<string | null>(null);
  useEffect(() => {
    setIso(new Date().toISOString().slice(0, 10));
  }, []);
  return iso;
}
