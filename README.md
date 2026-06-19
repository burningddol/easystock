# 이지스톡 (EasyStock)

카페·빙수 자영업자를 위한 재고·원가 관리 PWA. 매일 입력하는 매입·판매 데이터에서 메뉴별 마진과 재료 소진 예측을 자동으로 계산합니다.

> **페르소나 가드**: 사장님이 5분 안에 가치를 못 느끼면 이탈합니다. **입력이 지속되는 것**이 모든 가치의 전제. 프로젝트 결정은 [CLAUDE.md](CLAUDE.md) 참조.

## 기술 스택

- **프론트** Next.js 15 App Router · React 19 · TypeScript 5 · Tailwind 3 · shadcn/ui
- **상태** TanStack Query (서버) · Zustand (폼 임시저장) · React Hook Form + Zod
- **백엔드** Supabase Postgres (RLS user_id 격리) · Edge Functions (Deno) · pg_cron · pg_net
- **테스트** Vitest (단위/통합) · Playwright (E2E)
- **배포** Vercel · Supabase Cloud · GitHub Actions CI

## 처음 셋업

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수

`.env.local` 생성 (`.env.example` 참조):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon JWT>

# Push (선택, 베타 활성화 시)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid public>
VAPID_PRIVATE_KEY=<vapid private>
VAPID_SUBJECT=mailto:hello@easystock.app

# 분석 (선택)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXX
NEXT_PUBLIC_SENTRY_DSN=<sentry dsn>
```

### 3. 외부 인프라 셋업 가이드

- **Supabase 마이그레이션 + Edge Function + pg_cron**: [docs/setup-push.md](docs/setup-push.md)
- **GitHub Secrets** (CI 빌드용): [docs/setup-github.md](docs/setup-github.md)
- **VAPID 키 페어 생성**: [docs/setup-vapid.md](docs/setup-vapid.md)

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000

## 자주 쓰는 명령

| 명령                                                                     | 설명                                  |
| ------------------------------------------------------------------------ | ------------------------------------- |
| `npm run dev`                                                            | Next.js 개발 서버                     |
| `npm run build`                                                          | 프로덕션 빌드                         |
| `npm run typecheck`                                                      | TypeScript 타입 체크                  |
| `npm run lint`                                                           | ESLint                                |
| `npm run format:check`                                                   | Prettier 포맷 검사                    |
| `npm run test`                                                           | Vitest 단위 + 통합 (CI와 동일)        |
| `npm run test:e2e`                                                       | Playwright E2E                        |
| `npm run test:coverage`                                                  | 커버리지 (도메인 80% / 전체 60% 임계) |
| `npx supabase db push --linked --include-all`                            | 신규 마이그레이션 클라우드 적용       |
| `npx supabase gen types typescript --linked > src/lib/supabase/types.ts` | TS 타입 재생성                        |

## 디렉토리 구조

```text
src/
  app/(main)/              Next.js App Router 라우트 (5탭)
    today/                 홈 (오늘) — 어제 KPI / 알림 / 마진 TOP3
    calendar/              월간 캘린더
    sale/[date]/           판매 입력 (소급 포함)
    menu/                  메뉴 / 레시피
    inventory/             재고 / 소진 예측 / 실사
  features/                도메인별 분리 (sale / purchase / menu / inventory / dashboard / calendar)
  components/ui/           shadcn 원자 컴포넌트
  lib/
    domain/                헌법 III 핵심 (margin, pricing, snapshot, forecast)
    supabase/              client / rpc 래퍼 / types
    analytics/             GA4 + consent gate
    utils/                 format / use-today-iso 등
  types/                   도메인 타입
supabase/
  migrations/              순서대로 적용 (001~027)
  functions/               Edge Function (push-scheduler / d7-tracker / permanent-delete)
specs/001-mvp-core/        spec.md / data-model.md / contracts / tasks.md
```

## 헌법 (변경 시 spec 갱신 필수)

- **III. 마진 정의** — `재료 원가 기준 (이동평균법)`만 사용. 임대료·인건비 절대 미포함. UI에 항상 라벨 노출.
- **IV. 데이터 격리** — 모든 테이블에 RLS `user_id` 격리. 단일 사장님 전제지만 멀티테넌시 모델 유지.
- **테스트 v1.3.0** — 핵심 도메인 단위 + RLS 통합 + 페르소나 골든패스 E2E 의무. 도메인 80% / 전체 60% 커버리지 게이트.

상세는 [.specify/memory/constitution.md](.specify/memory/constitution.md).

## 재료 소진 예측 알고리즘

이지스톡의 소진 예측은 단순 최근 7일 평균이 아니라, **실제 판매 이력에서 재료별 일일 소비량을 만들고, 정기휴무·최근 추세·거래처 리드타임까지 반영한 뒤 하루씩 시뮬레이션**하는 방식입니다. 스펙 기준은 `FR-012`, `FR-013`, `FR-018`, `FR-025`, `FR-042`이고, 실제 구현 단일 출처는 [forecast.ts](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)입니다.

핵심 흐름은 이렇습니다.

1. **서버에서 raw 데이터 수집**
   - [021_get_depletion_forecast_rpc.sql](/Users/yamon/Desktop/projects/ezstock/supabase/migrations/021_get_depletion_forecast_rpc.sql)
   - 각 재료별로 `current_stock`, `signed_up_at`, `regular_days_off`, `safety_buffer_days`, 최근 90일 `consumption_samples`를 반환합니다.
   - `consumption_samples`는 `sale_items.quantity × recipe_items.quantity_per_serving`를 날짜별로 합산한 값입니다.
   - 거래처 리드타임은 해당 재료에 대해 **가장 자주 사용한 vendor의 리드타임**을 쓰고, 이력이 없으면 기본 `1일`을 사용합니다.

2. **가입 후 7일은 콜드스타트로 예측 중지**
   - [forecast.ts](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)
   - 가입 후 `7일 미만`이면 `isColdStart=true`로 처리하고, 소진일 예측은 돌리지 않습니다.
   - 그래서 재료 화면에는 “데이터 수집 중” 안내가 먼저 뜹니다.

3. **정기휴무를 제외한 계층형 최근가중 평균 계산**
   - [forecast.ts](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)
   - 기본 anchor는 빙수집/카페 운영 패턴에 맞춘 `평일(월~목)`, `금요일`, `주말(토~일)` 그룹입니다.
   - 개별요일 표본이 충분히 쌓이면 `월/화/수/목/금/토/일` 평균을 그룹 평균과 섞어 점진 반영합니다.
   - 개별요일 비중은 데이터가 쌓일수록 커지지만 최대 90%까지만 반영해, 그룹 평균을 안정화 anchor로 남깁니다.
   - 최근 sample일수록 `exp(-daysAgo / 14)` 방식으로 더 큰 가중치를 줍니다.
   - 정기휴무일은 평균 산정에서 제외합니다.
   - 단체주문 같은 극단값은 중앙값의 3배로 cap해서 예측 폭주를 완화합니다.
   - 그룹 표본이 8개 미만이면 **전체 영업일 평균과 섞는 shrinkage**를 적용해, 가맹점 초기 데이터가 적을 때도 예측이 과하게 튀지 않게 합니다.

4. **오늘부터 하루씩 재고 소진 시뮬레이션**
   - [forecast.ts](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)
   - 내일부터 최대 365일까지 하루씩 진행하면서, 영업일이면 그 날짜의 개별요일 평균을 우선 쓰고 데이터가 부족하면 영업일 타입 평균으로 fallback합니다.
   - 정기휴무는 소비 0으로 건너뜁니다.
   - 재고가 `0 이하`가 되는 첫 날짜를 예상 소진일로 잡습니다.

5. **리드타임 + 안전여유 1일로 상태 분류**
   - [forecast.ts](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)
   - 소진일까지 남은 일수에서 `거래처 리드타임 + 설정된 안전여유일`을 뺀 `buffer`로 상태를 나눕니다.
   - 기본값은 `안전여유 1일`이고, 설정 화면에서 `0~7일` 범위로 조정할 수 있습니다.
   - `critical`: buffer ≤ 1
   - `order_needed`: buffer = 2
   - `caution`: buffer 3~4
   - `safe`: buffer ≥ 5

6. **최근 사용량 급증/급감 감지 + 완만한 추세 보정**
   - [forecast.ts](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)
   - 최근 7일 평균과 30일 평균을 비교합니다.
   - 비율 차이가 `±20%`를 넘으면 `rising` 또는 `falling`으로 분류합니다.
   - 실제 소진일 계산에도 최근 추세를 반영하되, 계수는 `0.85~1.25`로 제한합니다.
   - 그래서 날씨/이벤트로 하루 매출이 튄 경우에도 예측이 과하게 흔들리지 않습니다.

7. **예측 민감도 설정**
   - 설정 화면에서 `안정적 / 기본 / 민감` 중 하나를 선택할 수 있습니다.
   - `안정적`은 최근 변동을 천천히 반영하고 이상치 영향을 더 줄입니다.
   - `기본`은 최근 흐름과 장기 평균을 균형 있게 반영합니다.
   - `민감`은 최근 판매 변화를 빠르게 반영해 날씨·이벤트 영향이 큰 매장에 맞춥니다.
   - 실제 파라미터는 [forecast.ts](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)의 `FORECAST_TUNING_PRESETS`가 단일 출처입니다.

중요한 구현 포인트:

- 서버 RPC는 **raw 데이터만** 만들고, 최종 `status/trend/isColdStart` 분류는 클라이언트 도메인 함수에서 수행합니다.
  - [useDepletionForecast.ts](/Users/yamon/Desktop/projects/ezstock/src/features/inventory/hooks/useDepletionForecast.ts)
- 즉, 예측 규칙의 단일 출처는 SQL이 아니라 TypeScript 도메인 모듈이며, 단위 테스트도 여기에 집중되어 있습니다.
  - [forecast.test.ts](/Users/yamon/Desktop/projects/ezstock/tests/unit/forecast.test.ts)

## 예측 정확도 백테스트

예측 알고리즘은 `/inventory/forecast-accuracy` 화면에서 실제 판매/소비 이력과 비교할 수 있습니다.

- 메뉴별 백테스트는 [loadMenuForecastAccuracyViews](/Users/yamon/Desktop/projects/ezstock/src/lib/application/inventory.ts)가 수행합니다.
- 재료별 백테스트는 [loadIngredientForecastAccuracyViews](/Users/yamon/Desktop/projects/ezstock/src/lib/application/inventory.ts)가 수행합니다.
- 각 비교일은 **그 전날까지의 데이터만 학습 데이터로 사용**해서 하루 뒤 예측값을 다시 만듭니다.
- 메뉴는 예측 판매 수량과 실제 판매 수량을 비교합니다.
- 재료는 메뉴 수요 예측, 기본 레시피, 옵션 선택률을 재료 소요량으로 변환한 뒤 실제 소비량과 비교합니다.
- 화면에는 평균 절대 오차, 평균 절대 백분율 오차, 과대/과소예측 방향을 표시합니다.

## 디자인 시스템

`.claude/skills/easystock-design-system/` — 토큰·컴포넌트·6개 화면 패턴 단일 진실 공급원. 색·spacing은 [tokens.ts](.claude/skills/easystock-design-system/tokens.ts)에서 import (하드코딩 금지). Pretendard 폰트 강제. PWA manifest의 `theme_color`/`background_color`만 hex literal 예외.

## 성공 지표 (MVP)

- D7 리텐션 40%+ (Phase 8 d7-tracker 자동 측정)
- 일일 판매 입력률 60%+
- 주간 재고 실사 수행률 50%+

지표 미달 시 기능 추가보다 **입력 마찰 줄이기**부터 검토.

## 라이선스

Private — 무단 복제·배포 금지.
