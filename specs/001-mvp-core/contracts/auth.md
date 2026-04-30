# Contract: Auth

**Source**: Supabase Auth (이메일+비밀번호) + Next.js 15 App Router 미들웨어
**Spec FR**: FR-001 (가입), FR-002 (격리), FR-034~037 (탈퇴/grace period)

## Interface

### Sign Up (가입)

**Endpoint**: 클라이언트 SDK `supabase.auth.signUp({ email, password, options })` + 후속 RPC `complete_signup(...)`

**Request (sign up)**:
```ts
type SignUpInput = {
  email: string;          // RFC 5322
  password: string;       // 최소 8자, Supabase 기본 정책
  storeName: string;      // 1~50자
  storeType: 'bingsu_cafe' | 'cafe' | 'dessert_cafe';
  regularDaysOff: ('MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN')[];  // 빈 배열 허용
}
```

**Response**:
```ts
type SignUpResult =
  | { success: true; userId: string }
  | { success: false; error: 'email_taken' | 'weak_password' | 'invalid_input' }
```

**Behavior**:
1. Supabase Auth로 가입 → `auth.users` 레코드 생성
2. 트리거 `on_auth_user_created` → `public.users` 자동 생성 (storeName, storeType, regularDaysOff)
3. analyticsConsent 기본 false (쿠키 동의 배너 별도)

**Validation (Zod)**:
- `email`: `z.string().email()`
- `password`: `z.string().min(8)`
- `storeName`: `z.string().min(1).max(50)`
- `storeType`: enum
- `regularDaysOff`: array of enum, max 7

---

### Sign In

**Endpoint**: `supabase.auth.signInWithPassword({ email, password })`

**Behavior**:
- Supabase 표준
- Grace period 사용자(`withdrawal_requested_at IS NOT NULL`)는 미들웨어에서 차단 + 복구 안내
- 영구 삭제된 사용자는 자연스럽게 "사용자 없음" 에러

---

### Sign Out

**Endpoint**: `supabase.auth.signOut()`

---

### Withdrawal (탈퇴 신청)

**Endpoint**: RPC `request_withdrawal()`

**Request**: 본인 인증 (auth.uid())로 자동

**Response**:
```ts
type WithdrawalResult = {
  success: true;
  permanentDeleteAt: string;  // ISO8601 timestamp
}
```

**Behavior**:
1. `users.withdrawal_requested_at = now()`, `permanent_delete_at = now() + interval '30 days'`
2. 사용자 안내 메시지 + 영구 삭제일 표시 (FR-037)
3. Edge Function `permanent-delete`가 cron으로 매일 실행해 만료 사용자 삭제

---

### Withdrawal Recovery (탈퇴 취소)

**Endpoint**: RPC `cancel_withdrawal()` 또는 grace period 중 로그인 시 복구 흐름

**Behavior**:
1. `withdrawal_requested_at = NULL`, `permanent_delete_at = NULL`
2. 정상 로그인 흐름 복귀

---

### Session Refresh (미들웨어)

**Endpoint**: `middleware.ts`에서 `@supabase/ssr` `updateSession()` 자동 호출

**Behavior**:
- 모든 요청 시 세션 갱신
- 쿠키 만료 → 자동 로그아웃
- Grace period 사용자는 모든 protected route에서 차단

---

## Authorization

- 모든 도메인 RPC 호출 시 `auth.uid()` 자동 적용 (RLS)
- service role key는 Edge Function에서만 (cron 푸시 발송, 영구 삭제)

## Errors

| 에러 코드 | 의미 | 사용자 표시 |
|---|---|---|
| `email_taken` | 이메일 중복 | "이미 가입된 이메일입니다" |
| `weak_password` | 비밀번호 정책 위반 | "비밀번호는 8자 이상이어야 합니다" |
| `withdrawal_in_progress` | grace period 중 로그인 | 복구 안내 + 영구 삭제 예정일 |
| `account_deleted` | 영구 삭제 | "사용자를 찾을 수 없습니다" (재가입 가능) |

---

## Test Coverage (헌법 v1.3.0)

- 통합: `tests/integration/rls.test.ts` — 가입 후 다른 사용자 데이터 접근 차단
- E2E: `tests/e2e/persona-golden-path.spec.ts` 가입 단계
