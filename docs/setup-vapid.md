# VAPID 키 셋업 (PWA Push)

이지스톡은 외부 푸시 서비스(OneSignal 등) 없이 Web Push API + VAPID로 직접 푸시 발송. 키 쌍은 1회 생성 후 영구 사용.

## 1. VAPID 키 생성

```powershell
npx web-push generate-vapid-keys
```

출력 예시:

```
=======================================
Public Key:
BG_xxx...xxx (87자)
Private Key:
yyy...yyy (43자)
=======================================
```

⚠️ **두 값 모두 안전한 곳에 백업**. 잃어버리면 재발급 시 모든 기존 푸시 구독이 무효화됨 (사용자 재구독 필요).

## 2. 환경변수 등록

### 로컬 개발 (`.env.local`)

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BG_xxx...xxx
VAPID_PRIVATE_KEY=yyy...yyy
VAPID_SUBJECT=mailto:hello@easystock.com
```

`.env.local`은 `.gitignore`되어 있어 커밋되지 않음. `.env.example`에 빈 값 placeholder.

### GitHub Repository Secrets

Settings → Secrets and variables → Actions:

- `VAPID_PUBLIC_KEY` (= `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

CI는 빌드 시 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`를 빌드 환경에 주입.

### Vercel Environment Variables

Project → Settings → Environment Variables:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Production + Preview + Development)
- `VAPID_PRIVATE_KEY` (Server only — sensitive로 마크)
- `VAPID_SUBJECT`

### Supabase Edge Function Secrets

Edge Function `push-scheduler`가 푸시 발송에 사용. CLI로 등록:

```powershell
npx supabase secrets set VAPID_PRIVATE_KEY=yyy...yyy --project-ref <ref>
npx supabase secrets set VAPID_SUBJECT=mailto:hello@easystock.com --project-ref <ref>
# Public key는 Edge Function이 web-push에 전달하기 위해 필요. 환경변수로 함께 등록.
npx supabase secrets set VAPID_PUBLIC_KEY=BG_xxx...xxx --project-ref <ref>
```

Supabase Dashboard → Edge Functions → Secrets 페이지에서도 확인 가능.

## 3. iOS Safari 16.4+ 안내

PWA Push는 iOS Safari 16.4+에서만 동작하며 **홈 화면에 추가**가 전제. 사용자 온보딩에서 다음을 안내해야 함:

1. Safari에서 이지스톡 접속
2. 공유 버튼 → "홈 화면에 추가"
3. 홈 화면 아이콘으로 앱 실행
4. 앱 안에서 "발주 알림 받기" 등 트리거 → 푸시 권한 모달

iOS 16.3 이하 사용자는 인앱 알림(상단 배너 + 캘린더 도트)으로 fallback (spec FR-013 edge case 명시).

## 4. 검증

1. 로컬 dev에서 `Notification.permission` 확인 (브라우저 콘솔)
2. Vercel preview 배포 후 모바일 Chrome/Safari에서 푸시 권한 grant 테스트
3. Supabase Edge Function `push-scheduler`를 수동 trigger:
   ```powershell
   curl -X POST "https://<ref>.supabase.co/functions/v1/push-scheduler" `
     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" `
     -H "Content-Type: application/json" `
     -d '{"type":"order_alert"}'
   ```
4. 디바이스에서 알림 수신 확인

## 5. 참고

- Web Push 표준: https://www.rfc-editor.org/rfc/rfc8030
- VAPID: https://www.rfc-editor.org/rfc/rfc8292
- iOS PWA Push: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- 페이로드 스키마: [specs/001-mvp-core/contracts/push.md](../specs/001-mvp-core/contracts/push.md)
