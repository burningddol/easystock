/**
 * 쿠키·분석 동의 상태 관리.
 *
 * PIPA: 신규 가입자 첫 진입 시 동의 배너로 의사 확인.
 * 거부 시 GA4 등 분석 스크립트 자체를 로드하지 않는다.
 */

export type ConsentState = "granted" | "denied" | "unset";

const STORAGE_KEY = "easystock-analytics-consent";

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return "unset";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "granted" || stored === "denied") return stored;
  return "unset";
}

export function setConsent(state: Exclude<ConsentState, "unset">): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, state);
  window.dispatchEvent(new CustomEvent("easystock:consent-changed", { detail: state }));
}

export function clearConsent(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("easystock:consent-changed", { detail: "unset" }));
}

export function subscribeConsent(callback: (state: ConsentState) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event): void => {
    const detail = (event as CustomEvent<ConsentState>).detail;
    callback(detail);
  };
  window.addEventListener("easystock:consent-changed", handler);
  return () => window.removeEventListener("easystock:consent-changed", handler);
}
