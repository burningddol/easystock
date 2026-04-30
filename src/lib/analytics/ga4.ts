/**
 * GA4 커스텀 이벤트 발송 (consent 게이트).
 *
 * 측정 대상 이벤트는 spec.md SC-008 funnel 참조:
 *   signup_complete → first_menu_registered → first_sale_input → d7_active
 *
 * `getConsent() !== "granted"`이면 발송 안 함 (PIPA).
 */

import { sendGAEvent } from "@next/third-parties/google";
import { getConsent } from "./consent";

export type Ga4EventName =
  | "signup_complete"
  | "consent_granted"
  | "consent_denied"
  | "first_menu_registered"
  | "template_loaded"
  | "first_sale_input"
  | "daily_sale_input"
  | "retroactive_sale_complete"
  | "sale_edited"
  | "first_purchase_logged"
  | "price_change_alert_shown"
  | "order_alert_received"
  | "stock_count_completed"
  | "weekly_loss_displayed"
  | "dashboard_viewed"
  | "calendar_viewed"
  | "calendar_missing_day_clicked"
  | "d7_active";

export type Ga4EventParams = Record<string, string | number | boolean | null>;

export function trackEvent(name: Ga4EventName, params: Ga4EventParams = {}): void {
  if (typeof window === "undefined") return;
  if (getConsent() !== "granted") return;
  sendGAEvent("event", name, params);
}
