# Push 인프라 사전 설정 체크리스트

푸시 알림(Phase 6 PR 33)은 코드 외 설정이 필요합니다. 본격 운영 전 5단계 모두 완료해야 cron이 실제 발송합니다.

## 1) VAPID 키 페어 생성 (한 번)

```bash
npx web-push generate-vapid-keys
```

출력된 Public/Private 키를 다음 위치 모두에 등록:

- `.env.local` — `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- GitHub Secrets — 동일 3개 (CI 빌드용)
- Supabase Edge Function Secrets (대시보드 → Edge Functions → push-scheduler → Secrets) — `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`

## 2) Supabase Extensions 활성화

대시보드 → Database → Extensions:

- `pg_cron` Enable
- `pg_net` Enable

미활성화 시 `023` 마이그레이션 push 자체가 실패합니다.

## 3) Supabase Vault에 service_role_key 등록

대시보드 → Database → Vault → New secret:

- name: `service_role_key`
- secret: Settings → API의 `service_role` JWT

Vault에 없으면 cron이 매 실행 시 `raise warning` 후 no-op (푸시 발송 안 됨).

## 4) Edge Function 배포

`supabase/functions/push-scheduler/`는 `.github/workflows/deploy-edge-functions.yml`이 master 머지 시 자동 배포. 수동 배포가 필요하면:

```bash
npx supabase functions deploy push-scheduler --project-ref <ref>
```

## 5) (선택) GA4 측정 활성화

T140 `order_alert_received` 등 서버측 발화 — Edge Function Secrets에:

- `GA4_MEASUREMENT_ID`
- `GA4_API_SECRET`

미설정 시 푸시는 정상 발송, GA4 측정만 skip.

## 검증

설정 완료 후 cron 실행 시각(KST 09:00 / 22:00 / 일 07:00)을 기다리거나, 강제 트리거:

```sql
-- Supabase SQL Editor
select private.invoke_push_scheduler('order_alert');
```

`pg_net._http_response` 테이블에서 응답을 확인할 수 있습니다.

## 시각 (KST → UTC)

| 알림             | KST        | UTC        | cron         |
| ---------------- | ---------- | ---------- | ------------ |
| order_alert      | 매일 09:00 | 매일 00:00 | `0 0 * * *`  |
| closing_reminder | 매일 22:00 | 매일 13:00 | `0 13 * * *` |
| stock_count      | 일 07:00   | 토 22:00   | `0 22 * * 6` |
