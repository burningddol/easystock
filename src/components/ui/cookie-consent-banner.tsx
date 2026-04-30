"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics/ga4";
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

  function handleDecision(decision: "granted" | "denied"): void {
    setConsent(decision);
    // Note: trackEvent gates on getConsent() === "granted". Calling here right after
    // setConsent ensures the storage write is observed by trackEvent's subsequent read.
    if (decision === "granted") {
      trackEvent("consent_granted");
    } else {
      // consent_denied은 게이트 통과 못 함 — denied 시에는 GA4 이벤트 미발화 (의도).
      // PIPA 정합. 거부 자체의 anonymized count가 필요하면 cookieless beacon 별도 도입.
    }
  }

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
            onClick={() => handleDecision("denied")}
            className="rounded-md border border-border px-stack py-stack-tight text-body-regular text-ink-2 hover:bg-card-hover"
          >
            거부
          </button>
          <button
            type="button"
            onClick={() => handleDecision("granted")}
            className="rounded-md bg-ink-1 px-stack py-stack-tight text-body-regular text-bg hover:opacity-90"
          >
            동의
          </button>
        </div>
      </div>
    </div>
  );
}
