# Contract: Web Push (PWA)

**Source**: Web Push API (VAPID), `web-push` npm + Supabase Edge Function `push-scheduler`
**Spec FR**: FR-013 (발주 알림), FR-014 (마감 입력 독려), FR-015 (재고 실사 알림)
**Constraints**: 헌법 II (모바일·PWA 우선), iOS 16.4+ 푸시 지원, 정기휴무일 발송 제외 (FR-041)

---

## VAPID 환경변수

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BG...           # 클라이언트 노출
VAPID_PRIVATE_KEY=...                        # 서버 전용 (Edge Function secrets)
VAPID_SUBJECT=mailto:hello@easystock.com
```

`web-push generate-vapid-keys` 1회 생성 후 Vercel + Supabase secrets에 저장.

---

## 클라이언트: 구독 흐름

### 권한 요청 시점

스펙: 첫 가치 경험 직후 (메뉴 1개 등록 + 첫 판매 입력 완료) → R1 결정.

코드 위치: `src/lib/push/client.ts`

```ts
// 의사 코드
async function requestPushPermissionAndSubscribe(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    // 인앱 알림 fallback (FR edge case)
    return null;
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  await supabase.rpc('subscribe_push', {
    endpoint: sub.endpoint,
    keys: sub.toJSON().keys,
    user_agent: navigator.userAgent,
  });
}
```

### iOS 안내

- iOS 16.3 이하: `'PushManager' in window === false` → 인앱 배너로 안내
- iOS 16.4+ 단, **홈 화면 추가 PWA에서만** 작동 → 온보딩에서 "홈 화면에 추가" 가이드 노출

---

## 서버: 발송 흐름 (Supabase Edge Function `push-scheduler`)

### 트리거

Supabase pg_cron으로 다음 스케줄 등록:
- `0 0 * * *` (UTC) = 한국시 09:00 → 발주 알림 발송
- `0 13 * * *` (UTC) = 한국시 22:00 → 마감 입력 독려
- `0 22 * * 0` (UTC) = 한국시 07:00 월요일 → 재고 실사 알림

각 cron이 Edge Function HTTP 호출.

### Edge Function 의사 코드

```ts
// supabase/functions/push-scheduler/index.ts (Deno)
import webpush from 'npm:web-push';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  const { type } = await req.json();  // 'order_alert' | 'closing_reminder' | 'stock_count'
  const today = new Date();  // KST 변환
  const dayOfWeek = ...;     // 'MON' | ...

  // 활성 사용자 + 오늘이 정기휴무 아닌 사용자 조회 (service role)
  const { data: users } = await admin
    .from('users')
    .select('id, regular_days_off, push_subscriptions(*)')
    .is('withdrawal_requested_at', null)
    .not('regular_days_off', 'cs', `{${dayOfWeek}}`);  // 정기휴무 제외

  for (const user of users) {
    const payload = await buildPayload(user.id, type);  // 발주 필요 재료 등 동적 생성
    if (!payload) continue;  // 발송할 내용 없으면 skip

    for (const sub of user.push_subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        if (err.statusCode === 410) {  // 구독 만료
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }
  }
});
```

---

## 푸시 페이로드 스키마

모든 푸시는 동일 envelope 사용:

```ts
type PushPayload = {
  type: 'order_alert' | 'closing_reminder' | 'stock_count' | 'critical_depletion';
  title: string;       // 알림 제목
  body: string;        // 본문
  url?: string;        // 클릭 시 이동 경로 (예: '/inventory')
  badge?: number;      // 발주 필요 항목 수 등
  data?: Record<string, unknown>;
};
```

### 타입별 예시

#### 발주 알림 (FR-013, 09:00)

```ts
{
  type: 'order_alert',
  title: '발주 필요 재료 2건',
  body: '딸기 2일 후 소진 예상, 우유 1일 후 소진 예상',
  url: '/inventory',
  badge: 2
}
```

발송 조건: `status='order_needed'` 재료 ≥ 1개. 0개면 발송 skip.

#### 마감 입력 독려 (FR-014, 22:00)

```ts
{
  type: 'closing_reminder',
  title: '오늘 판매 입력 1분이면 끝나요',
  body: '마감 후 메뉴별 판매량을 빠르게 입력해보세요',
  url: '/sale'
}
```

발송 조건: 오늘 sold_at의 Sale 레코드 없음. 있으면 skip (이미 입력 완료).

#### 재고 실사 알림 (FR-015, 월 07:00)

```ts
{
  type: 'stock_count',
  title: '주간 재고 실사하기',
  body: '월요일 오픈 전 5분 안에 재고를 점검하세요',
  url: '/inventory?action=stock_count'
}
```

발송 조건: 지난 7일 내 DailyStockCount 없음.

#### 긴급 소진 (FR-013 critical 단계)

```ts
{
  type: 'critical_depletion',
  title: '⚠️ 재료 소진 임박',
  body: '딸기 오늘 영업 중 소진 예상',
  url: '/inventory'
}
```

발송 조건: `status='critical'` 재료 발견 시. 09:00 외에 영업 중 발견되면 즉시 발송 가능 (별도 cron 불필요, 클라이언트 inventory 진입 시 detect 후 RPC로 트리거 가능 — 1차 MVP는 09:00 fixed로 단순화).

---

## Service Worker 처리

`public/sw.js`:

```js
self.addEventListener('push', (event) => {
  const payload = event.data?.json();
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      badge: '/icons/badge.png',
      icon: '/icons/icon-192.png',
      data: { url: payload.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
```

---

## Test Coverage (헌법 v1.3.0)

- 통합: Edge Function 로컬 실행 (`supabase functions serve`) + mock 사용자 → 페이로드 검증
- 단위: 페이로드 생성 로직 (`buildPayload`) — 발주 알림 0건 시 skip, 정기휴무 제외, 콜드스타트 처리 등
- E2E: 직접 검증 어려움 (실제 푸시 발송) → 수동 검증 (Vercel preview 환경에서 cron trigger)

---

## 보안

- VAPID private key는 Supabase Edge Function secrets에만 저장
- 페이로드에 PII 포함 금지 (재료명·메뉴명은 사용자 본인 데이터라 OK)
- 구독 endpoint는 `endpoint` 글로벌 unique → 다른 사용자가 endpoint 가로채는 시나리오 방지
- HTTPS only (PWA는 HTTPS 필수)
