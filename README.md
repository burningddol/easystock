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

## 통계·예측 알고리즘

이지스톡의 예측은 “최근 며칠 평균” 하나로 끝내지 않습니다. 실제 구현은 **메뉴 수요 예측 → 옵션 선택률 반영 → 재료 소요량 환산 → 소진일/발주 판단 → 백테스트 정확도 표시** 흐름으로 연결됩니다. 핵심 구현 단일 출처는 [forecast.ts](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)와 [inventory.ts](/Users/yamon/Desktop/projects/ezstock/src/lib/application/inventory.ts)입니다.

### 1. 원천 데이터

- 메뉴 수요 예측은 메뉴별 과거 판매 수량(`demandSamples`)을 사용합니다.
- 재료 소진 예측은 판매 항목과 레시피를 곱해 만든 일별 재료 소비량(`consumptionSamples`)을 사용합니다.
- 매출 예측은 메뉴별 예측 판매량에 현재 메뉴 가격을 곱해 합산합니다.
- 서버 RPC는 current stock, 판매/소비 sample, 정기휴무, 리드타임, 설정값 같은 raw 데이터를 반환하고, 최종 예측 규칙은 TypeScript 도메인 함수에서 계산합니다.
- 관련 진입점: [useDepletionForecast.ts](/Users/yamon/Desktop/projects/ezstock/src/features/inventory/hooks/useDepletionForecast.ts), [useMenuDemandForecast.ts](/Users/yamon/Desktop/projects/ezstock/src/features/inventory/hooks/useMenuDemandForecast.ts)

### 2. 콜드스타트

- 가입 후 `7일 미만`은 콜드스타트로 봅니다.
- 이 기간에는 소진일을 무리하게 찍지 않고 “데이터 수집 중”으로 표시합니다.
- 정확히 7일이 되는 경계부터는 예측을 시작합니다.
- 신뢰도도 판매/소비 표본 수와 요일 보정 비율을 함께 보고 `높음 / 보통 / 낮음 / 수집 중`으로 표시합니다.

### 3. 계층형 요일 예측 모델

운영 예측의 기본 단위는 개별 요일 7개가 아니라 다음 3개 그룹입니다.

- `weekday`: 월~목
- `friday`: 금요일
- `weekend`: 토~일

이렇게 묶는 이유는 작은 매장 데이터에서는 월요일, 화요일처럼 요일을 완전히 쪼개면 표본이 너무 적어 날씨·단체주문·누락 입력에 과민해지기 때문입니다. 대신 그룹 평균을 안정적인 anchor로 두고, 개별요일 데이터가 쌓일수록 점진 반영합니다.

계산 방식:

- 최근 sample일수록 `exp(-daysAgo / decayDays)`로 더 큰 가중치를 줍니다.
- 기본 모드의 `decayDays`는 `14`입니다.
- 단체주문 같은 극단값은 중앙값 기반 cap으로 완화합니다.
- 그룹 표본이 부족하면 전체 영업일 평균과 섞어 초기 예측 폭주를 줄입니다.
- 개별요일 반영 비중은 `요일 표본 수 / (요일 표본 수 + prior)`입니다.
- 기본 `prior=12`라서 표본 5건은 약 29%, 10건은 약 45%, 20건은 약 63%, 40건은 약 77%만 개별요일을 반영합니다.
- 개별요일 비중은 최대 `85%`까지만 허용해 그룹 평균을 안정화 anchor로 남깁니다.

### 4. 예측 민감도 설정

설정 화면의 `안정적 / 기본 / 민감`은 같은 모델의 파라미터만 바꿉니다.

| 모드   | 최근가중 반감 성격 | 그룹 최소 표본 | 요일 prior |   이상치 cap | 용도                           |
| ------ | ------------------ | -------------: | ---------: | -----------: | ------------------------------ |
| 안정적 | 느리게 반영        |             12 |         16 | 중앙값 2.5배 | 판매 변동이 작고 안정적인 매장 |
| 기본   | 균형               |              8 |         12 |   중앙값 3배 | 일반 카페/빙수집 기본값        |
| 민감   | 빠르게 반영        |              5 |          8 |   중앙값 4배 | 날씨·이벤트 영향이 큰 매장     |

실제 값은 [forecast.ts](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)의 `FORECAST_TUNING_PRESETS`가 단일 출처입니다.

### 5. 메뉴 수요 예측

- 메뉴별 판매 수량을 재료 예측과 같은 계층형 요일 모델에 넣습니다.
- 미래 `horizonDays`만큼 날짜를 하루씩 만들고, 해당 날짜의 정기휴무 여부와 요일 그룹을 확인합니다.
- 정기휴무일은 예측 수량 `0`입니다.
- 영업일이면 개별요일 평균 → 영업일 그룹 평균 → 전체 영업일 평균 순서로 fallback합니다.
- 최근 7일 평균과 30일 평균 차이가 `±20%` 이상이면 증가/감소 trend를 표시합니다.
- trend는 예측 수량에도 반영하지만 계수는 `0.85~1.25`로 제한해 과도한 흔들림을 막습니다.

### 6. 옵션 선택률 기반 재료 소요량

메뉴 예측은 옵션까지 재료 소요량에 반영합니다.

- 기본 레시피는 `예측 메뉴 수량 × 기본 재료 사용량`으로 계산합니다.
- 추가 옵션(`add_on`)은 `예측 메뉴 수량 × 옵션 선택률 × 옵션 재료 사용량`으로 계산합니다.
- 택1 옵션(`single`)은 선택률 합이 있으면 선택률을 합계 1로 정규화합니다.
- 택1 옵션 선택률 데이터가 아직 없으면 기본 옵션(`isDefault`)을 균등 fallback으로 사용합니다.
- 이렇게 만든 날짜별 재료 수요가 재료 소진 예측과 발주 추천의 우선 근거가 됩니다.

관련 함수:

- [forecastMenuDemand](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)
- [forecastIngredientDemandFromMenus](/Users/yamon/Desktop/projects/ezstock/src/lib/domain/forecast.ts)
- [loadMenuBasedIngredientDemandForecast](/Users/yamon/Desktop/projects/ezstock/src/lib/application/inventory.ts)

### 7. 재료 소진일과 발주 추천

재료 소진일은 현재 재고에서 미래 일별 예상 소비량을 하루씩 차감해 계산합니다.

- 내일부터 최대 365일까지 시뮬레이션합니다.
- 정기휴무는 소비량 0으로 건너뜁니다.
- 재고가 `0 이하`가 되는 첫 날짜를 예상 소진일로 봅니다.
- 1년 안에 소진되지 않으면 소진일은 `null`입니다.

상태 분류는 예상 소진일까지 남은 일수에서 `거래처 리드타임 + 안전여유일`을 뺀 buffer로 결정합니다.

| 상태           | 기준                        |
| -------------- | --------------------------- |
| `critical`     | buffer ≤ 1                  |
| `order_needed` | buffer = 2                  |
| `caution`      | buffer 3~4                  |
| `safe`         | buffer ≥ 5 또는 소진일 없음 |

발주 추천량은 `리드타임 + 안전여유 + 목표 운영일` 동안의 예상 소비량에서 현재 재고를 뺀 부족분입니다. 기본 목표 운영일은 7일입니다.

### 8. 정기휴무와 예외 영업

- 정기휴무 요일은 누락 카운트, 판매 입력 독려, 예측 평균 산정에서 제외합니다.
- 정기휴무일이라도 판매가 입력되면 예외 영업일로 보고 캘린더와 예측 산정에 포함합니다.
- 정기휴무 변경은 이후 예측에 바로 반영되지만, 과거 데이터 자체를 삭제하지는 않습니다.
- 휴무였던 요일이 영업일로 바뀌면 초기에는 그룹 평균으로 fallback하고, 해당 요일 데이터가 쌓일수록 개별요일 보정 비중이 올라갑니다.

### 9. 백테스트 정확도 지표

예측 정확도는 `/inventory/forecast-accuracy`에서 확인합니다. 모든 백테스트는 **각 비교일의 전날까지 데이터만 학습 데이터로 사용**해 “그날을 실제로 맞혔다면 어땠는가”를 재현합니다.

사용 지표:

| 대상 | 주요 지표                                           | 화면 표시                                |
| ---- | --------------------------------------------------- | ---------------------------------------- |
| 메뉴 | 평균 절대 수량오차, WAPE, 과대/과소 방향            | `평균 N개 오차`                          |
| 매출 | 평균 절대 금액오차, WAPE, signed error              | `평균 N만원 오차`, `예상보다 더/덜 나옴` |
| 재료 | 평균 절대 소비오차, WAPE, 평균 일수오차, 부족위험일 | `보통 ±N일`, `빠르면 N일`                |

WAPE는 `총 절대오차 / 총 실제값`입니다. 기존 MAPE처럼 일별 퍼센트를 단순 평균내지 않습니다. 실제값이 작은 날 하나 때문에 오차율이 과장되는 문제를 줄이기 위해, 운영 판단에는 WAPE와 절대오차를 같이 씁니다.

신뢰도 기준:

- 비교 가능한 날이 3일 미만이면 `데이터 부족`
- WAPE `80% 이상`이면 `신뢰도 낮음`
- WAPE `35% 이상`이면 `주의`
- 그 외는 `신뢰도 좋음`

편향 기준:

- 예측 총량이 실제 총량보다 15% 이상 크면 `과대예측`
- 예측 총량이 실제 총량보다 15% 이상 작으면 `과소예측`
- 그 사이면 `균형`

원인 후보:

- 비교 가능한 데이터 부족
- 총량 기준 오차 과다
- 과소예측으로 인한 부족 위험
- 과대예측으로 인한 과발주 위험
- 특정 요일 오차 집중
- 예측은 있었지만 실제 판매/소비가 없던 날 반복

### 10. 캘린더와 날짜 상세의 운영형 표시

캘린더는 통계 지표를 그대로 노출하지 않고 사장님이 바로 판단할 수 있는 단위로 바꿉니다.

- 미래 캘린더 셀: `예상 100만±8만`
- 미래 날짜 상세: `92만~108만원` 예상 범위
- 과거 캘린더 셀: `오차 +8만` 또는 `오차 -8만`
- 과거 날짜 상세: `예상보다 8만원 더 나옴` 또는 `예상보다 8만원 덜 나옴`
- 메뉴 예측 카드: `평균 2.3개 오차`
- 재료 예측 카드: `보통 ±1.3일 · 빠르면 3일`

여기서 `+`는 실제 매출이 예측보다 더 나왔다는 뜻이고, `-`는 실제 매출이 예측보다 덜 나왔다는 뜻입니다. 미래 예상 범위는 최근 백테스트의 평균 절대 금액오차를 사용합니다.

## 디자인 시스템

`.claude/skills/easystock-design-system/` — 토큰·컴포넌트·6개 화면 패턴 단일 진실 공급원. 색·spacing은 [tokens.ts](.claude/skills/easystock-design-system/tokens.ts)에서 import (하드코딩 금지). Pretendard 폰트 강제. PWA manifest의 `theme_color`/`background_color`만 hex literal 예외.

## 성공 지표 (MVP)

- D7 리텐션 40%+ (Phase 8 d7-tracker 자동 측정)
- 일일 판매 입력률 60%+
- 주간 재고 실사 수행률 50%+

지표 미달 시 기능 추가보다 **입력 마찰 줄이기**부터 검토.

## 라이선스

Private — 무단 복제·배포 금지.
