/* eslint-disable no-undef */
/**
 * 이지스톡 PWA 서비스 워커 (Web Push 수신 + 클릭 처리)
 * 계약: specs/001-mvp-core/contracts/push.md
 *
 * GA4 측정은 push-scheduler Edge Function이 서버측 Measurement Protocol로
 * 발화 (T140). 클라이언트는 환경 변수 주입 경로가 없어 서버측이 더 신뢰성 높음.
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      badge: "/icons/badge.png",
      icon: "/icons/icon-192.png",
      data: { url: payload.url, type: payload.type },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(self.clients.openWindow(url));
});
