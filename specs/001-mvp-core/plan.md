# Implementation Plan: MVP 핵심 — 6개 화면 통합

**Branch**: `001-mvp-core` | **Date**: 2026-04-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mvp-core/spec.md`

## Summary

빙수카페 사장님(페르소나 김지영)이 매일 입력하는 매입·판매 데이터를 받아 메뉴별 실시간 마진과 재료 소진 예측을 보여주는 모바일·PWA 서비스의 1차 MVP. 6개 user story(US1~US6)를 단일 Next.js App Router 프로젝트 안에 도메인별 features 폴더로 구현하며, Supabase가 Auth + Postgres(RLS) + Edge Functions(푸시 스케줄러) + Storage를 담당한다. 디자인은 `.claude/skills/easystock-design-system` 스킬이 단일 진실 공급원으로 토큰·컴포넌트·화면 패턴을 제공하며, 테스트는 Vitest(단위/통합) + Playwright(E2E) + Codecov(커버리지 임계치 핵심 도메인 80%/전체 60%)로 헌법 v1.3.0 Testing & Coverage 의무를 충족한다. Phase 순서는 페르소나 사용 빈도(헌법 Implementation Order: sale=P1)와 다르게 의존성 기준으로 조정 — Foundational 직후 menu(US3)를 먼저 구현해 Phase 4(sale)에서 마진 표시까지 가능한 첫 검증 지점을 만든다.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, `any` 금지) on Node.js 20 LTS
**Primary Dependencies**:
- Frontend: Next.js 15 (App Router) + React 19, Tailwind CSS, shadcn/ui, TanStack Query v5, Zustand, React Hook Form + Zod, Recharts, date-fns (ko locale), Pretendard 폰트 (CDN)
- PWA: `next-pwa` 또는 App Router PWA 패턴 (manifest + service worker + Web Push API VAPID)
- Backend: Supabase JS Client (`@supabase/supabase-js`), Supabase SSR helpers (`@supabase/ssr`)
- Test: Vitest + @testing-library/react, Playwright, MSW (API mocking)
- Observability: GA4 (`@next/third-parties/google` 또는 직접), Vercel Analytics, Sentry (`@sentry/nextjs`)

**Storage**: Supabase Postgres (RLS user_id 격리). Supabase Storage는 1차 MVP에서 사용하지 않음 (이미지 업로드 등 미포함)
**Testing**:
- 단위/통합: Vitest + React Testing Library + MSW
- E2E: Playwright (페르소나 골든패스 1개)
- 커버리지: Codecov, 핵심 도메인 80% / 전체 60% (헌법 v1.3.0)
- CI: GitHub Actions (test → coverage upload → threshold check → block PR merge on regression)

**Target Platform**: 모바일 우선 PWA (iOS Safari 16.4+, Android Chrome 최신). 데스크탑은 반응형 fallback. 한국어 단일.
**Project Type**: Single Next.js project with backend-as-a-service (Supabase). 별도 backend 디렉토리 없음.
**Performance Goals** (페르소나 5분 입력 흐름 보장):
- 판매 입력 첫 페인트(FCP): ≤ 1초
- 판매 입력 인터랙티브(TTI): ≤ 2초
- 마진 실시간 계산 응답: ≤ 100ms (클라이언트 계산, 서버 라운드트립 없음)
- 캘린더 30일 렌더: ≤ 1초
- 푸시 발송: 예약 시각 ±5분
**Constraints**:
- 모바일 우선 (헌법 II), PWA + Web Push API 직접 사용 (외부 푸시 서비스 의존 없음)
- 모든 테이블 user_id RLS 격리 (헌법 IV) — RLS 없는 테이블은 PR 머지 차단
- 마진 표시 모든 지점 "재료 원가 기준 (이동평균법)" 라벨 의무 (헌법 III, FR-019)
- 가중 이동 평균법 + Sale 시점 메뉴 원가 스냅샷 보존 (헌법 III, FR-004/008)
- 디자인 토큰 하드코딩 금지 — `.claude/skills/easystock-design-system/tokens.ts` import (헌법 Design Source)
**Scale/Scope**:
- MVP 100 동시 사용자, 1년 1000 동시 사용자 (Supabase 무료~저가 플랜으로 충분)
- 1 사용자 = 1 가게 (1차 MVP). 가게당 ~20 메뉴, ~30 재료, ~10 거래처, 월 ~30 판매 레코드 (일 단위 일괄 입력)
- 1년 누적 데이터 < 1MB/사용자 → 1000 사용자 ≈ 1GB
- 6개 화면, 5탭 네비게이션 (오늘/캘린더/판매/메뉴/재료) + 매입 컨텍스트 진입

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

헌법 v1.3.0 (`.specify/memory/constitution.md`)의 7개 원칙 + Technology Constraints + Development Workflow를 모두 검증:

### NON-NEGOTIABLE 원칙

| 원칙 | 게이트 항목 | 통과 여부 |
|---|---|---|
| **I. 입력 마찰 1순위** | 페르소나 5분 입력 흐름이 성능 목표(FCP 1초, 마진 계산 100ms)로 측정 가능. 테스트에서 페르소나 골든패스 E2E로 검증 | ✅ Pass |
| **III. 재료 원가 기준 마진** | FR-019(라벨 의무) + FR-004/008(가중 평균 + 스냅샷)이 spec에 명시. 단위 테스트로 회귀 차단 (헌법 v1.3.0 Testing) | ✅ Pass |
| **IV. user_id RLS 격리** | 모든 도메인 테이블에 RLS 정책 의무. 통합 테스트로 회귀 차단 (헌법 v1.3.0 Testing) | ✅ Pass |
| **V. 스코프 가드** | OCR/POS/자동 발주/권한관리/순이익 등 1차 MVP 제외 (spec Out of Scope). 데이터 export, 멀티 디바이스 Realtime, 일회성 휴업도 명시적 Out of Scope | ✅ Pass |

### 기타 원칙

| 원칙 | 게이트 항목 | 통과 여부 |
|---|---|---|
| **II. 모바일·PWA 우선** | Next.js 15 PWA + Web Push API. 모바일 레이아웃 우선, 데스크탑은 반응형 fallback. iOS 16.4+ 푸시 지원 | ✅ Pass |
| **VI. 명확성·`any` 금지** | TypeScript strict + `any` 금지 명시. 코드 리뷰가 2차 가드 | ✅ Pass |
| **VII. 검증 가능한 가설** | spec SC-001~SC-012 모두 측정 가능, GA4 + Supabase 쿼리로 추적 | ✅ Pass |

### Technology Constraints (헌법 명시 스택 일치)

| 헌법 명시 | plan 채택 | 일치 |
|---|---|---|
| Next.js 15 (App Router) + PWA | Next.js 15 + App Router + next-pwa/manifest | ✅ |
| Tailwind + shadcn/ui | Tailwind CSS + shadcn/ui | ✅ |
| TanStack Query (서버) + Zustand (클라이언트) | TanStack Query v5 + Zustand | ✅ |
| RHF + Zod | React Hook Form + Zod | ✅ |
| Supabase (Auth + Postgres + Realtime + Storage + RLS) | Supabase JS + SSR helpers + Edge Functions. Realtime은 1차 MVP 미사용(spec Q4 last-write-wins) | ✅ (Realtime은 Out of Scope으로 정합) |
| Recharts / date-fns ko | Recharts + date-fns ko | ✅ |
| Vercel + Supabase Cloud | Vercel + Supabase Cloud | ✅ |

### Development Workflow

| 의무 | 충족 |
|---|---|
| Implementation Order (헌법 6개 화면 P1~P6) | Phase 3~8에 모두 포함. 의존성 기준 순서 조정은 Project Structure 섹션에 정당화 |
| Design Source (`.claude/skills/easystock-design-system` 항상 참조) | Phase 1 산출물(data-model + contracts)과 Phase 3+ 구현 모두 참조. 토큰 import 경로 명시 (`@/lib/design-tokens` 또는 직접 import) |
| Testing & Coverage (단위/통합/E2E + Codecov 80%/60% + CI 게이트) | Vitest + Playwright + Codecov + GitHub Actions로 충족 |
| Phase Validation (각 Phase 완료 후 로컬 검증) | 각 Phase 끝에 manual verification 지점 명시 |

**Constitution Check 결과**: ✅ All gates pass. 게이트 위반 없음, 정당화 필요 없음.

## Project Structure

### Documentation (this feature)

```text
specs/001-mvp-core/
├── spec.md              # Feature specification (이미 완료, /speckit-specify + clarify)
├── plan.md              # 본 파일 (/speckit-plan 출력)
├── research.md          # Phase 0 산출물 (/speckit-plan 출력)
├── data-model.md        # Phase 1 산출물 (/speckit-plan 출력)
├── quickstart.md        # Phase 1 산출물 (/speckit-plan 출력)
├── contracts/           # Phase 1 산출물 (/speckit-plan 출력)
│   ├── auth.md          # Auth API 계약
│   ├── domain-rpc.md    # 도메인 RPC 함수 계약 (마진 계산, 단가 갱신 등)
│   └── push.md          # Web Push 메시지 페이로드 계약
└── checklists/
    └── requirements.md  # spec 품질 체크리스트 (이미 완료)
```

### Source Code (repository root)

```text
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 인증 라우트 그룹
│   │   ├── login/
│   │   └── signup/
│   ├── (main)/                   # 5탭 네비게이션 라우트 그룹
│   │   ├── layout.tsx            # 하단 탭 + Pretendard 폰트
│   │   ├── today/                # 오늘(홈) — US5
│   │   ├── calendar/             # 캘린더 — US6
│   │   ├── sale/                 # 판매 — US1
│   │   ├── menu/                 # 메뉴/레시피 — US3
│   │   └── inventory/            # 재료/소진 예측 — US4
│   ├── purchase/                 # 매입 (컨텍스트 진입, 5탭 외) — US2
│   ├── settings/                 # 가게 정보·정기휴무·탈퇴
│   ├── layout.tsx                # 루트 레이아웃 (PWA manifest, GA4, Sentry, Pretendard)
│   ├── manifest.ts               # PWA 매니페스트
│   └── api/                      # Route handlers (RPC, Web Push 구독 등)
│       └── push/
│           ├── subscribe/
│           └── send/
├── features/                     # 도메인별 분리
│   ├── sale/
│   │   ├── components/           # SaleInputForm, MenuRow, StickyTotal 등
│   │   ├── hooks/                # useSaleSubmit, useFavoriteMenus
│   │   └── lib/                  # 도메인 함수 (단위 테스트 대상)
│   ├── purchase/
│   ├── menu/
│   ├── inventory/
│   ├── dashboard/                # today
│   ├── calendar/
│   └── settings/
├── components/ui/                # shadcn/ui 원자 컴포넌트
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # 브라우저 클라이언트
│   │   ├── server.ts             # 서버 컴포넌트 클라이언트
│   │   └── types.ts              # 자동 생성된 DB 타입
│   ├── design-tokens.ts          # easystock-design-system 토큰 re-export
│   ├── domain/                   # 횡단 도메인 로직 (단위 테스트 대상, 커버리지 80%)
│   │   ├── pricing.ts            # 가중 이동 평균법
│   │   ├── margin.ts             # 메뉴 원가/마진 계산
│   │   ├── forecast.ts           # 소진 예측
│   │   ├── regular-days-off.ts   # 정기휴무 제외 로직
│   │   └── snapshot.ts           # Sale 시점 스냅샷
│   ├── analytics/
│   │   ├── ga4.ts                # GA4 이벤트 추적 + 동의 게이트
│   │   └── consent.ts            # 쿠키 동의 상태 관리
│   ├── push/
│   │   └── client.ts             # Web Push 구독 헬퍼
│   ├── query-client.ts           # TanStack Query 설정
│   └── utils/                    # 잡유틸 (date 포맷, 숫자 포맷 tabular-nums 등)
├── stores/                       # Zustand 스토어 (입력 폼 임시저장 등)
└── types/                        # 도메인 타입 (zod 스키마에서 추론)
    ├── domain.ts                 # Ingredient, Menu, Sale 등
    └── db.ts                     # supabase types re-export

supabase/
├── migrations/                   # SQL 마이그레이션 (RLS 정책 포함)
│   ├── 001_users_and_isolation.sql
│   ├── 002_ingredients_and_pricing.sql
│   ├── 003_menus_and_recipes.sql
│   ├── 004_sales_with_snapshot.sql
│   ├── 005_purchases_and_history.sql
│   ├── 006_stock_counts.sql
│   ├── 007_sale_edit_history.sql
│   └── 008_user_withdrawal_grace.sql
├── functions/                    # Edge Functions
│   ├── push-scheduler/           # cron으로 푸시 발송
│   └── permanent-delete/         # grace period 만료 사용자 영구 삭제
└── seed/                         # 빙수카페·카페 음료 템플릿

tests/
├── unit/                         # Vitest 단위 — 도메인 로직 우선
│   ├── pricing.test.ts
│   ├── margin.test.ts
│   ├── forecast.test.ts
│   ├── regular-days-off.test.ts
│   └── snapshot.test.ts
├── integration/                  # Vitest 통합 — Supabase 트랜잭션·RLS
│   ├── rls.test.ts
│   ├── sale-save.test.ts
│   ├── sale-edit.test.ts
│   └── purchase-flow.test.ts
└── e2e/                          # Playwright
    └── persona-golden-path.spec.ts

.github/
└── workflows/
    ├── ci.yml                    # test + lint + typecheck + Codecov upload + threshold check
    └── deploy-edge-functions.yml # Supabase Edge Functions 배포
```

**Structure Decision**: Single Next.js project (App Router). Supabase는 service이므로 별도 backend 디렉토리 없음. 헌법의 `src/features/{도메인}/` 구조 유지하면서, 도메인 횡단 로직은 `src/lib/domain/`에 모아 단위 테스트 우선 작성. shadcn/ui는 `src/components/ui/`에 격리. Supabase 마이그레이션·Edge Functions는 `supabase/` 루트 폴더 (Supabase CLI 표준).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

해당 없음 — 모든 게이트 통과. 다만 다음 의도적 결정은 정당화 기록 차원에서 명시:

| 의도적 결정 | 근거 |
|---|---|
| Phase 순서 (menu → sale 우선)가 헌법 Implementation Order(sale=P1)와 다름 | 헌법은 페르소나 사용 빈도 기준 우선순위, 실제 Phase는 의존성 기준. sale의 마진 계산이 menu/recipe에 의존하므로 Foundational 직후 menu 우선. Phase 4(sale)에서 첫 MVP 검증 지점 도달. 헌법 Amendment 없이 plan 차원 결정 |
| Realtime 미사용 (헌법 Technology Constraints에 명시되어 있음에도) | spec Clarification Q4(last-write-wins) 결정. 헌법은 stack 가용성 명시일 뿐 의무 사용은 아님. Out of Scope 명시됨 |
| Supabase Storage 미사용 | 1차 MVP에 이미지 업로드 등 사용 사례 없음. 추후 메뉴 사진 등 추가 시 도입 |
