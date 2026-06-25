# Phase 0 Research: MVP 핵심 — 6개 화면 통합

**Date**: 2026-04-30
**Plan**: [plan.md](./plan.md)

Technical Context의 [NEEDS CLARIFICATION] 항목 0개 (사용자 입력에서 모두 해소됨). 그 외 stack 결정의 근거·대안 비교를 라이브러리/패턴 단위로 기록한다.

---

## R1. PWA + Web Push API 패턴 (Next.js 15 App Router)

**Decision**:
- App Router 네이티브 PWA 패턴 사용 — `app/manifest.ts` + 수동 `service-worker.js` (`public/`에 배치)
- Web Push 구독은 클라이언트 컴포넌트에서 `navigator.serviceWorker.ready.pushManager.subscribe(...)` 호출
- 서버는 `web-push` npm 패키지로 VAPID 키 사용해 발송 (Supabase Edge Function에서 실행)
- VAPID 키 쌍은 환경변수로 보관 (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)

**Rationale**:
- `next-pwa`는 Pages Router 시절의 라이브러리. App Router 호환성 문제·유지보수 정체. 직접 manifest + SW가 더 깔끔
- iOS 16.4+ Safari가 PWA 푸시를 지원하지만 **홈 화면 추가가 전제**. 온보딩에서 안내 (spec FR + edge case 명시)
- `web-push`는 Node 표준이라 Supabase Edge Function (Deno) 환경에서도 호환됨 (Deno에서 npm:web-push로 import)

**Alternatives considered**:
- OneSignal / Firebase Cloud Messaging: 외부 의존성·비용·사용자 동의 복잡도 증가, MVP 부적합
- next-pwa 라이브러리: App Router 미지원·유지보수 문제

---

## R2. Supabase SSR + RLS + 타입 자동 생성

**Decision**:
- 클라이언트: `@supabase/ssr` 패키지의 `createBrowserClient()` (브라우저 컴포넌트), `createServerClient()` (서버 컴포넌트/route handlers)
- 미들웨어로 세션 갱신: `middleware.ts`에서 `updateSession()` 호출
- 타입 자동 생성: `supabase gen types typescript --linked > src/lib/supabase/types.ts` (CI에 포함)
- RLS 정책은 모든 도메인 테이블에 의무 — `(auth.uid() = user_id)` 단일 패턴

**Rationale**:
- `@supabase/ssr`이 App Router 표준 (Supabase 공식 권장)
- 타입 자동 생성은 도메인 변경 시 컴파일 시점에 누락·오타 차단
- RLS 단일 패턴이라 통합 테스트(`tests/integration/rls.test.ts`)로 일괄 검증 가능

**Alternatives considered**:
- 직접 `supabase-js`만 사용 + 수동 세션 관리: SSR 시 쿠키 핸들링 복잡, 보안 헛점 위험
- Drizzle/Prisma 도입: Supabase가 이미 PostgREST+JS API 제공해 ORM 추가는 과함

---

## R3. 가중 이동 평균법 단가 산정 — 정확도와 부동소수점

**Decision**:
- 단가·수량은 정수 단위로 저장 (단가는 "원" 단위 정수, 수량은 "g" 또는 "ml" 정수)
- 평균 단가 계산은 **정수 산술** 또는 `decimal.js`로 처리. JS 부동소수점 누적 오차 회피
- DB 컬럼 타입: `numeric(12,4)` (4자리 소수점) — 정밀도 보존
- 단위 테스트로 30일 매입 시뮬레이션 시 수동 계산값과 ≤ 0.01원 오차 검증 (SC-009)

**Rationale**:
- JS Number는 부동소수점 — 누적 매입에서 오차 누적 가능
- `numeric(12,4)`는 Postgres 권장 패턴, 회계용 정밀도 보장
- 헌법 III가 회계 정확성 요구하므로 부동소수점은 NON-NEGOTIABLE 위반 가능성

**Alternatives considered**:
- JS Number로 처리: 단순하지만 부동소수점 오차 누적 위험
- `Big.js` / `Decimal.js`: `decimal.js`가 라이브러리 크기·성능 균형 좋음. 클라이언트 번들에 포함 (~30KB gzip)
- DB에서만 계산 (Postgres `numeric`): 마진 실시간 계산(<100ms) 시 라운드트립 부담. 클라이언트 계산 + DB 검증 패턴 유지

---

## R4. 소진 예측 알고리즘 (계층형 최근가중 평균 + 리드타임 + 안전여유)

**Decision**:
- 알고리즘 구현은 `src/lib/domain/forecast.ts` 단일 모듈로 격리
- 정상 영업일을 `평일(월~목)`, `금요일`, `주말(토~일)` 그룹으로 나누고, 각 그룹의 최근가중 평균을 기본 anchor로 사용
- 개별요일 평균은 표본 수에 따라 `count / (count + prior)` 방식으로 그룹 평균과 섞는 shrinkage 적용
- 기본 예측 민감도는 `prior=12`, 개별요일 최대 반영 비중 `85%`; 표본 5건은 약 29%, 10건은 약 45%, 20건은 약 63%, 40건은 약 77%만 개별요일 반영
- 최근 sample일수록 지수감쇠 가중치(`exp(-daysAgo / decayDays)`)로 더 크게 반영
- 단체주문 같은 극단값은 중앙값 기반 cap으로 완화
- 정기휴무 요일은 평균 산정에서 제외 (FR-042)
- 거래처 리드타임 + 안전여유 1일 = 발주 시점 권고 = 소진 예상일 - (리드타임 + 1일)
- 7일 평균 vs 30일 평균 차이 ±20% 이상 시 사용량 급증/급감 배지 (FR-025)
- 메뉴 기반 재료 수요는 최근 14일 백테스트의 `actualTotal / predictedTotal`로 재료별 보정계수를 계산한다
- 보정은 비교 가능일 7일 이상일 때만 적용하고, 5% 이내 차이는 노이즈로 보고 무시한다
- 보정계수는 `0.85~1.30`으로 clamp하며 DB에 누적 저장하지 않고 현재 조회 시점에만 계산한다
- 예측 결과에는 데이터 일수, 평균 개별요일 보정 비율, 신뢰도 레벨을 함께 노출
- 백테스트 결과에는 WAPE, 절대오차, 일수오차, 과대/과소 방향, 원인 후보를 생성해 점주가 조치할 수 있게 함
- 단위 테스트: 합성 데이터 시나리오 ≥ 10개 (정상/급증/급감/콜드스타트/리드타임 long-tail/정기휴무 포함)

**Rationale**:
- 단일 모듈로 격리하면 테스트 우선 작성 + 80% 커버리지 충족 쉬움
- 합성 데이터 시나리오로 알고리즘 회귀 차단 — 실제 사용자 데이터 없이도 검증 가능
- 정기휴무 제외는 헌법 v1.3.0 Testing & Coverage 의무 항목
- 사장님은 통계 모델 자체보다 "왜 이렇게 나왔는지"를 알아야 실제 발주 판단에 쓸 수 있음
- 원인 후보는 모델 자동 조정보다 먼저 사람이 확인 가능한 신호(데이터 부족, 특정 요일 오차, 과대/과소예측)를 보여주는 MVP 방식이 안전함
- 최근 오차 보정은 장기 누적 학습이 아니라 현재 window의 편향만 낮추는 안전장치다. 원재료 변경, 옵션 선택률 변화, 판매 누락이 있어도 보정 폭을 제한해 발주량 폭주를 막는다
- MAPE는 실제값이 작은 날에 과도하게 튀므로 운영 지표로는 WAPE와 절대오차를 병행하는 편이 더 안정적임
- 재료 예측은 퍼센트보다 “며칠 빨리/늦게 소진될 수 있는지”가 발주 판단에 직접 연결되므로 일수오차를 1차 UX 지표로 사용함
- 매출 예측은 퍼센트보다 “예상보다 몇 만원 더/덜 나왔는지”와 “예상 범위”가 점주 의사결정에 더 직접적임

**Alternatives considered**:
- 단순 7일 평균: 요일 패턴 무시, 빙수카페는 주말 매출 2배라 부정확
- 개별요일 100% 평균: 요일별 표본이 작을 때 날씨·공휴일·단체주문 노이즈에 과민
- 일별 MAPE 단독 사용: 작은 실제값에서 오차율이 무한정 커지고, 매출/발주 의사결정 단위로 해석하기 어려움
- 머신러닝 / Prophet: 1차 MVP 과함, 데이터 누적 부족
- 계절성 자동 보정: 헌법 V 스코프 가드로 차단됨

---

## R4b. 메뉴·매출·재료 예측 정확도 지표

**Decision**:
- 예측 정확도 화면은 매출, 메뉴, 재료를 탭으로 분리한다
- 모든 백테스트는 비교일 전날까지의 데이터만 사용해 해당 날짜의 예측을 재생성한다
- 메뉴 정확도는 평균 절대 수량오차와 WAPE를 함께 계산한다
- 매출 정확도는 메뉴별 예측 수량 × 메뉴 가격을 합산해 예측 매출을 만들고, 실제 매출과 비교한다
- 매출 화면에는 평균 절대 금액오차, WAPE, signed error(예상보다 더/덜 나옴)를 표시한다
- 재료 정확도는 메뉴 수요 예측, 기본 레시피, 옵션 선택률을 재료 소요량으로 환산한 뒤 실제 소비량과 비교한다
- 재료 화면에는 평균 절대 소비오차, WAPE, 평균 일수오차, 부족위험일, 과소/과대 예측 방향을 표시한다
- 재료 소진 예측에는 정확도 화면의 퍼센트 오차를 그대로 곱하지 않고, 최근 14일 actual/predicted 총량 비율만 제한적으로 반영한다
- 신뢰도는 비교 가능일 3일 미만이면 데이터 부족, WAPE 80% 이상이면 낮음, 35% 이상이면 주의, 그 외 좋음으로 분류한다

**Rationale**:
- 사용자가 실제로 판단하는 단위는 “몇 % 틀렸는가”보다 “몇 개 더 준비할까”, “몇 만원 범위로 볼까”, “며칠 빨리 소진될 수 있나”에 가깝다
- WAPE는 기간 전체 총량 기준이라 작은 실제값 하나가 전체 정확도 평가를 왜곡하는 MAPE 문제를 줄인다
- signed error는 예측 대비 실제 매출이 더 나왔는지 덜 나왔는지 보여준다. 같은 8만원 오차라도 실제가 더 나온 것과 덜 나온 것은 운영 해석이 다르다
- 재료는 과대예측보다 과소예측이 영업 중 품절로 이어질 위험이 크므로, 과소예측일을 별도로 세고 risk-adjusted day error로 정렬한다
- 보정계수를 누적 학습하지 않는 이유는 작은 매장의 입력 누락과 이벤트성 주문이 많기 때문이다. 누적 보정은 drift를 키울 수 있어, MVP는 rolling backtest 기반의 bounded calibration을 사용한다

**Alternatives considered**:
- MAPE 단독: 작은 실제값에서 오차율이 과장되고 무한대에 가까워질 수 있어 배제
- RMSE: 큰 오차를 강하게 벌주는 장점은 있지만 점주에게 “몇 개/몇 만원/며칠”로 설명하기 어렵다
- AI/LLM 직접 예측: 데이터 누적이 적은 MVP에서 재현성·검증 가능성·비용 측면이 약함. 현재는 결정론적 모델 + 백테스트가 더 안전함
- 예측 결과 DB 저장: 서버 캐시와 재계산 비용에는 장점이 있지만, 현재 데이터 규모에서는 클라이언트 계산 + TanStack Query 캐시가 단순하고 충분함

---

## R5. Sale 시점 메뉴 원가 스냅샷 — 저장·편집·삭제 트랜잭션

**Decision**:
- Sale 저장 시 클라이언트에서 메뉴 원가를 계산해 페이로드에 포함, 서버는 검증 후 저장 (`sales.menu_cost_snapshot` JSONB)
- 또는 Postgres function (`save_sale_with_snapshot(...)`)에서 트랜잭션 처리:
  1. 메뉴 원가 계산 (현재 평균 단가 기준)
  2. Sale 레코드 + 항목 저장
  3. 재고 자동 차감
  - 모두 단일 트랜잭션, 실패 시 rollback
- Sale 편집 (FR-030~033): RPC `edit_sale(sale_id, new_items)`이 트랜잭션으로:
  1. 기존 항목 스냅샷을 SaleEditHistory에 기록
  2. 차감된 재고 되돌림
  3. 새 항목 + 새 스냅샷 저장
  4. 재고 재차감
- 7일 초과 Sale은 RPC에서 거부 (서버 검증)

**Rationale**:
- DB 단일 트랜잭션이 데이터 일관성 보장 (재고 음수 방지, 부분 실패 방지)
- RPC 함수는 RLS 정책 + auth.uid() 자동 적용 가능
- 클라이언트 계산 + 서버 검증 이중 패턴은 마진 표시 즉시성 + 데이터 무결성 둘 다 충족

**Alternatives considered**:
- 클라이언트에서 다단계 호출: 트랜잭션 보장 못 함, 부분 실패 시 데이터 불일치 위험
- 트리거 기반: Postgres 트리거로 스냅샷 자동 생성 → 명시성 떨어짐, 디버깅 어려움. RPC가 명시적 + 테스트 쉬움

---

## R6. PWA 푸시 발송 스케줄러 (Supabase Edge Function + cron)

**Decision**:
- Supabase `pg_cron` 확장으로 cron 스케줄 등록 (예: `0 9 * * *` = 매일 아침 9시 KST)
- cron이 Supabase Edge Function `push-scheduler`를 호출
- Edge Function에서 다음 로직:
  1. 활성 사용자 + 정기휴무 요일 아닌 사용자 조회
  2. 발주 필요 재료(소진 1~2일 전) 조회
  3. 재고 실사 알림 대상 (월요일) 조회
  4. 마감 입력 독려 (밤 10시) 알림 대상 조회
  5. 각 사용자별 푸시 발송 (`web-push` 라이브러리)
- 시간대: 서버는 UTC, KST(+9) 변환 후 비교. 사용자별 가게 시간대는 KST 단일 (spec Assumptions)

**Rationale**:
- Supabase pg_cron은 무료 플랜에서도 사용 가능 (Edge Function 호출 cron job)
- Edge Function은 Deno 런타임이라 npm:web-push import 가능
- 발송 ±5분 허용(spec 성능 목표)이라 cron 1분 단위 정확도면 충분

**Alternatives considered**:
- Vercel Cron Jobs: Vercel 유료 플랜 필요, Supabase에 통합되는 게 더 깔끔
- 클라이언트 측 알림 (브라우저 schedule): PWA 푸시는 백그라운드 발송이 핵심, 클라이언트 활성 시점 의존 안 됨

---

## R7. GA4 + 쿠키 동의 (PIPA 준수)

**Decision**:
- GA4: `@next/third-parties/google` 의 `<GoogleAnalytics />` 컴포넌트 사용
- 쿠키 동의 게이트: 자체 구현 배너 (`src/lib/analytics/consent.ts`)
  - 첫 진입 시 배너 노출
  - 동의/거부 상태를 localStorage + 서버 사용자 레코드에 저장 (FR + edge case)
  - 거부 시 GA4 스크립트 자체를 로드하지 않음 (단순 명확)
- 측정 이벤트 (커스텀 이벤트):
  - `signup_complete`
  - `first_menu_registered`
  - `first_sale_input`
  - `d7_active`
  - `calendar_missing_day_clicked`
  - `retroactive_sale_complete`
- 사용자 ID는 익명 UUID (Supabase user.id ≠ GA4 user_id, 별도 익명 매핑)

**Rationale**:
- `@next/third-parties/google`이 Next.js 공식 패턴, hydration 충돌 없음
- 동의 거부 시 스크립트 미로드가 PIPA 준수의 가장 단순한 형태 (cookieless 모드 등 복잡 옵션 회피)
- 익명 UUID는 GA4 audience 분석은 가능하지만 개인 재식별 불가 — PIPA 안전

**Alternatives considered**:
- GA4 cookieless 모드: 데이터 정확도 ↓, 구현 복잡도 ↑
- 외부 동의 관리 SDK (CookieYes, OneTrust): MVP 과함
- Mixpanel/Amplitude: GA4가 무료·Vercel 통합 좋음

---

## R8. Codecov + GitHub Actions 임계치 게이트

**Decision**:
- GitHub Actions workflow (`.github/workflows/ci.yml`):
  ```
  jobs:
    test:
      - npm ci
      - npm run lint
      - npm run typecheck
      - npm run test:unit -- --coverage
      - npm run test:integration -- --coverage
      - npm run test:e2e
      - codecov-action with coverage files
  ```
- Codecov 설정 (`codecov.yml`):
  ```yaml
  coverage:
    status:
      project:
        default:
          target: 60%
          threshold: 1%   # 1% 이상 떨어지면 fail
      patch:
        default:
          target: 80%   # 신규 코드는 80% 이상
    flags:
      domain:
        paths: [src/lib/domain/, src/features/*/lib/]
        target: 80%
  ```
- `flags.domain` 설정으로 핵심 도메인만 80% 임계치 적용

**Rationale**:
- Codecov flags 기능으로 영역별 임계치 분리 가능 (헌법 v1.3.0 의무 충족)
- patch coverage(신규 코드)에 80% 적용하면 신규 도메인 함수가 강제로 테스트됨
- threshold 1%로 미세한 회귀 허용 (테스트 데이터 변경 등으로 인한 false positive 방지)

**Alternatives considered**:
- 자체 CI 임계치 검사 스크립트: codecov가 이미 표준, 재발명 불필요
- SonarCloud: 무료 plan 제약, codecov가 공개 리포에 더 친화적

---

## R9. Pretendard 폰트 적용 (Next.js 15 App Router)

**Decision**:
- `next/font` 사용: `Pretendard`는 Google Fonts에 없으므로 `next/font/local`로 정의
- 폰트 파일은 `public/fonts/pretendard-variable.woff2` 단일 variable 폰트 (가중치 100~900)
- `app/layout.tsx`에서 폰트 변수 설정, Tailwind 토큰과 연결
- 디자인 시스템 스킬의 `tokens.json`에 폰트 패밀리 정의가 이미 있음 → 그대로 import

**Rationale**:
- variable font 단일 파일이 다중 파일보다 로딩 빠름
- `next/font`가 자동 preload + font-display: swap 처리
- 디자인 시스템 명시 폰트(`헌법 Design Source` + 디자인 시스템 SKILL.md)

**Alternatives considered**:
- CDN 직접 로드 (`<link href="cdn.jsdelivr.net/.../pretendard.css">`): FOUT 가능성, Lighthouse 점수 저하
- 시스템 폰트 fallback만 사용: 디자인 시스템 폰트 의무 위반

---

## R10. shadcn/ui ↔ easystock-design-system 매핑 전략

**Decision**:
- shadcn/ui는 비주얼 base 제공, **Tailwind 토큰 override**로 디자인 시스템 적용
- `tailwind.config.ts`에서 `tokens.ts`의 색·spacing·radius·typography 토큰을 Tailwind 테마로 매핑
- shadcn/ui 컴포넌트 추가 시 `tailwind.config.ts`의 토큰 사용 → 자동으로 디자인 시스템 색상 적용
- 디자인 시스템의 `components.md` 사양 ↔ shadcn 컴포넌트 매핑:
  - Card → shadcn Card + 디자인 토큰 보더(`#e8e5db`)·그림자 제거
  - Button → shadcn Button + 디자인 변형 (primary, ghost, danger)
  - Chip/Tag → shadcn Badge + 변형
  - Metric → 자체 컴포넌트 (`src/components/ui/metric.tsx`) — shadcn에 직접 매칭 없음
  - Sticky Total Card (판매 입력 합계) → 자체 컴포넌트
- 신규 컴포넌트는 디자인 시스템 components.md에 먼저 추가 → 코드 구현 (헌법 Design Source)

**Rationale**:
- shadcn은 코드 복사 방식이라 토큰 적용이 자유로움
- Tailwind 토큰 단일 진실 공급원 → 색·간격·radius 변경 시 한 곳에서
- 매핑 표를 plan에 명시해두면 implement 단계에서 헷갈림 없음

**Alternatives considered**:
- shadcn 미사용 + 자체 컴포넌트 라이브러리: 시간 부담, 접근성 reinventing
- Radix UI 직접: shadcn이 Radix 위에 빌드된 거라 shadcn으로 충분

---

## R11. PWA 오프라인 전략 (1차 MVP)

**Decision**:
- 오프라인 모드 미지원 (spec Out of Scope) — 명시
- Service Worker는 Push API 등록 + 기본 cache (정적 자산만)
- 데이터 오프라인 캐시 안 함 (Supabase 직접 호출, 네트워크 의존)

**Rationale**:
- spec Assumptions: 인터넷 안정 가정. 페르소나는 매장에서 Wi-Fi 또는 LTE 안정 환경
- 오프라인 데이터 동기화는 Realtime/충돌 해결과 함께 묶여 2차 검토 항목

**Alternatives considered**:
- Workbox + IndexedDB 캐시: 1차 MVP 과함, 오프라인 시 last-write-wins 충돌 처리 복잡

---

## 요약: 모든 NEEDS CLARIFICATION 해소 완료

Phase 1 (Design & Contracts)로 진입 가능.
