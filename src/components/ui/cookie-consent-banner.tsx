"use client";

import { useEffect, useState } from "react";
import {
  type ConsentState,
  getConsent,
  setConsent,
  subscribeConsent,
} from "@/lib/analytics/consent";

export function CookieConsentBanner(): React.ReactElement | null {
  const [state, setState] = useState<ConsentState>("unset");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setState(getConsent());
    return subscribeConsent(setState);
  }, []);

  if (!mounted || state !== "unset") return null;

  return (
    <div
      role="dialog"
      aria-label="쿠키 동의"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-screen shadow-sm"
    >
      <div className="mx-auto flex max-w-screen-md flex-col gap-stack sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-regular text-ink-2">
          서비스 개선을 위한 분석 쿠키 사용에 동의해 주세요. 거부해도 모든 기능은 정상 사용
          가능합니다.
        </p>
        <div className="flex shrink-0 gap-stack-tight">
          <button
            type="button"
            onClick={() => setConsent("denied")}
            className="rounded-md border border-border px-stack py-stack-tight text-body-regular text-ink-2 hover:bg-card-hover"
          >
            거부
          </button>
          <button
            type="button"
            onClick={() => setConsent("granted")}
            className="rounded-md bg-ink-1 px-stack py-stack-tight text-body-regular text-bg hover:opacity-90"
          >
            동의
          </button>
        </div>
      </div>
    </div>
  );
}
