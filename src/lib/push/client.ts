"use client";

import { createClient } from "@/lib/supabase/client";
import { subscribePush, unsubscribePush } from "@/lib/supabase/rpc";

/**
 * 브라우저 Web Push 구독 헬퍼.
 * Spec: contracts/push.md
 *
 * 흐름:
 *   1. Notification permission 요청 (이미 granted면 skip)
 *   2. ServiceWorker 등록 확인 + ready
 *   3. PushManager.subscribe(VAPID public key)
 *   4. subscription을 subscribe_push RPC로 DB 저장
 *
 * 발화 시점은 R1 (첫 가치 경험 직후) — 가입 직후가 아니라 first_sale_input 성공 후.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushPermissionResult =
  | { ok: true; subscriptionId: string }
  | { ok: false; reason: "unsupported" | "denied" | "vapid_missing" | "error"; message?: string };

export async function requestPushPermissionAndSubscribe(): Promise<PushPermissionResult> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "unsupported" };
  }
  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return { ok: false, reason: "unsupported" };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { ok: false, reason: "vapid_missing" };
  }

  if (Notification.permission === "denied") {
    return { ok: false, reason: "denied" };
  }
  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    if (result !== "granted") {
      return { ok: false, reason: "denied" };
    }
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // BufferSource type 호환을 위해 .buffer 슬라이스 형태로 전달
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "error", message: "subscription incomplete" };
    }

    const supabase = createClient();
    const { data, error } = await subscribePush(supabase, {
      endpoint: json.endpoint,
      keysP256dh: json.keys.p256dh,
      keysAuth: json.keys.auth,
      userAgent: navigator.userAgent,
    });

    if (error || !data) {
      return { ok: false, reason: "error", message: error?.message };
    }
    return { ok: true, subscriptionId: data };
  } catch (err: unknown) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function unsubscribeCurrentPush(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const supabase = createClient();
  await unsubscribePush(supabase, subscription.endpoint);
  await subscription.unsubscribe();
}

/**
 * VAPID public key는 base64url 형식. PushManager.subscribe는 Uint8Array 요구.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const result = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    result[i] = raw.charCodeAt(i);
  }
  return result;
}
