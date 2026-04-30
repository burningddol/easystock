---
description: "Task list for 001-mvp-core feature implementation"
---

# Tasks: MVP 핵심 — 6개 화면 통합

**Input**: Design documents from `/specs/001-mvp-core/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 헌법 v1.3.0 Testing & Coverage 의무에 따라 단위/통합/E2E 테스트 task가 포함되어 있음 (TDD-light: 핵심 도메인 로직은 테스트 우선 작성).

**Organization**: 의존성 기준 Phase 순서 — Foundational 직후 menu(US3) → sale(US1, MVP 첫 검증) → purchase → inventory → dashboard → calendar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 file이며 의존성 없음 → 병렬 실행 가능
- **[Story]**: US{N} 라벨 (Setup/Foundational/Polish phase는 라벨 없음)
- 모든 task에 정확한 file path 포함

## Path Conventions

- 도메인 함수: `src/lib/domain/{name}.ts`
- 도메인 features: `src/features/{도메인}/...`
- 라우트: `src/app/...`
- 마이그레이션: `supabase/migrations/00X_*.sql`
- Edge Functions: `supabase/functions/{name}/index.ts`
- 테스트: `tests/{unit|integration|e2e}/{name}.test.ts`
- 분석: `src/lib/analytics/...`
- CI: `.github/workflows/...`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Next.js + Supabase + 디자인 시스템 + 테스트 + 관측성 + CI 인프라 셋업

- [x] T001 Initialize Next.js 15 App Router project manually in repository root: write `package.json` (Next 15 + React 19), `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `public/`. Run `npm install` to generate `package-lock.json`. (Manual init avoids `create-next-app` refusing on non-empty dir)
- [x] T002 [P] Configure TypeScript strict mode and `noUncheckedIndexedAccess` in `tsconfig.json`; add `paths` aliases for `@/lib`, `@/features`, `@/components`
- [x] T003 [P] Install core dependencies: `npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query zustand react-hook-form zod @hookform/resolvers recharts date-fns decimal.js`
- [x] T004 [P] Install dev dependencies: `npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom @playwright/test msw`
- [x] T005 [P] Configure ESLint and Prettier with TypeScript rules; ban `any` and require explicit return types in `eslint.config.mjs`
- [x] T006 [P] Configure Tailwind CSS with token integration in `tailwind.config.ts`; map colors, spacing, radius from design system tokens
- [x] T007 Setup Pretendard variable font: download `pretendard-variable.woff2` to `public/fonts/`; configure `next/font/local` in `src/app/layout.tsx`
- [x] T008 Initialize shadcn/ui: `npx shadcn@latest init`; configure with custom Tailwind tokens
- [x] T009 [P] Re-export design tokens at `src/lib/design-tokens.ts` from `.claude/skills/easystock-design-system/tokens.ts`
- [x] T010 [P] Configure Vitest in `vitest.config.ts` with jsdom environment, coverage reporters (json + text + html), and include patterns for `tests/unit/**` and `tests/integration/**`
- [x] T011 [P] Configure Playwright in `playwright.config.ts` with mobile viewport (375x667) for persona testing
- [x] T012 [P] Initialize Supabase CLI project: `supabase init`; create `supabase/config.toml` with project ref placeholder
- [x] T013 Create PWA manifest at `src/app/manifest.ts` with name "이지스톡", theme color from design tokens, icons (192/512), display=standalone
- [x] T014 Create service worker stub at `public/sw.js` with push event listener and notificationclick handler (per contracts/push.md)
- [x] T015 Register service worker in `src/app/layout.tsx` via client component; setup VAPID public key from `NEXT_PUBLIC_VAPID_PUBLIC_KEY` env
- [x] T016 [P] Install GA4 dependency: `npm install @next/third-parties`; create `src/lib/analytics/ga4.ts` with typed event sender (gated by consent)
- [x] T017 [P] Create cookie consent state manager at `src/lib/analytics/consent.ts` (localStorage + Supabase sync via `record_consent` RPC stub)
- [x] T018 [P] Create cookie consent banner component at `src/components/ui/cookie-consent-banner.tsx`; renders only when consent state unset
- [x] T019 [P] Install Sentry: `npm install @sentry/nextjs`; configure `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` with DSN from env
- [x] T020 [P] Add Vercel Analytics: `npm install @vercel/analytics`; integrate `<Analytics />` in `src/app/layout.tsx`
- [x] T021 [P] Create CI workflow at `.github/workflows/ci.yml` with jobs: lint-typecheck, test-unit, test-integration, test-e2e, build-check; upload coverage to Codecov with flags `domain` and `overall`
- [x] T022 [P] Create Edge Functions deploy workflow at `.github/workflows/deploy-edge-functions.yml` triggered by changes in `supabase/functions/**`
- [x] T023 [P] Create DB migration workflow at `.github/workflows/migrate-db.yml` with `workflow_dispatch` and environment input (staging/prod)
- [x] T024 [P] Create Codecov configuration at `codecov.yml` with project target 60%, patch target 80%, flag `domain` paths to `src/lib/domain/` and `src/features/*/lib/`
- [x] T025 GitHub repo setup (manual or `gh` CLI): enable branch protection on `main` requiring CI passing, Codecov check, and 1 review; document in `docs/setup-github.md`
- [x] T026 Register GitHub secrets (manual): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_GA4_ID`, `SENTRY_DSN`, `CODECOV_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- [x] T027 Generate VAPID keys: `npx web-push generate-vapid-keys`; document in `docs/setup-vapid.md`; register to Supabase Edge Function secrets and GitHub secrets
- [x] T028 [P] Create `.env.example` at repo root with all required env var names (no values) for local dev onboarding
- [x] T029 [P] Update `package.json` scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `test:unit`, `test:integration`, `test:e2e`, `test:coverage`, `db:reset`, `db:migrate`, `db:gen-types`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Auth, RLS, 데이터 모델 기반, 라우팅, 정기휴무 — 모든 user story가 의존

**⚠️ CRITICAL**: 이 phase 완료 전에는 어떤 user story도 시작 금지

### 데이터 모델 기반

- [x] T030 Write SQL migration `supabase/migrations/001_users_and_isolation.sql` creating `public.users` table, `regular_days_off` text[] column, withdrawal fields, trigger to sync from `auth.users`, RLS policies (per data-model.md §1)
- [x] T031 Write SQL migration `supabase/migrations/002_ingredients_and_pricing.sql` creating `ingredients`, `ingredient_price_history` tables, indexes, RLS policies (per data-model.md §2-3)
- [x] T032 [P] Write SQL migration `supabase/migrations/008_user_withdrawal_grace.sql` adding indexes for `permanent_delete_at` and Edge Function dependency (per data-model.md §1)
- [x] T033 Generate TypeScript types from schema: `npm run db:gen-types > src/lib/supabase/types.ts`; commit generated types (1차 stub: 미들웨어 의존 테이블만 손으로 정의, 마이그 적용 후 실제 generated 타입으로 후속 PR에서 대체)
- [x] T034 [P] Create Supabase browser client at `src/lib/supabase/client.ts` using `createBrowserClient`
- [x] T035 [P] Create Supabase server client at `src/lib/supabase/server.ts` using `createServerClient` for App Router server components
- [x] T036 Create middleware at `src/middleware.ts` calling `updateSession()` to refresh auth cookies; block grace-period users from protected routes (per contracts/auth.md)

### Auth 흐름

- [x] T037 [P] Create signup page at `src/app/(auth)/signup/page.tsx` with form (email, password, storeName, storeType, regularDaysOff multiselect) using RHF + Zod
- [x] T038 [P] Create signup form component at `src/features/auth/components/SignupForm.tsx`; on submit calls `supabase.auth.signUp` then `complete_signup` RPC
- [x] T039 [P] Create login page at `src/app/(auth)/login/page.tsx` and `LoginForm` component
- [x] T040 Create signup completion RPC migration `supabase/migrations/009_complete_signup_rpc.sql` (handled via `handle_new_auth_user` trigger from migration 001 — separate RPC unnecessary, raw_user_meta_data 흐름 표준)
- [x] T041 Wire `signup_complete` GA4 event firing in signup success handler (gated by analytics_consent)
- [x] T042 Wire `consent_granted` / `consent_denied` GA4 events in cookie banner click handlers (denied은 게이트 통과 안 하므로 미발화 — PIPA 정합)
- [x] T043 Implement withdrawal RPC: write `supabase/migrations/010_request_withdrawal_rpc.sql` setting `withdrawal_requested_at = now()`, `permanent_delete_at = now() + interval '30 days'`
- [x] T044 Create permanent delete Edge Function `supabase/functions/permanent-delete/index.ts` with cron trigger (daily) to cascade-delete users past `permanent_delete_at`

### 5-Tab 네비게이션 + 라우팅

- [x] T045 Create `src/app/(main)/layout.tsx` with bottom tab navigation (오늘/캘린더/판매/메뉴/재료) per design system patterns.md
- [x] T046 [P] Create empty page stubs: `src/app/(main)/today/page.tsx`, `calendar/page.tsx`, `sale/page.tsx`, `menu/page.tsx`, `inventory/page.tsx` (each renders "준비 중")
- [x] T047 [P] Create `src/app/purchase/page.tsx` (context-entry, not in bottom tab) stub
- [x] T048 [P] Create `src/app/settings/page.tsx` for store info / 정기휴무 / 탈퇴 stub

### 정기휴무 등록 흐름

- [x] T049 [P] Write `update_regular_days_off` RPC migration `supabase/migrations/011_update_regular_days_off_rpc.sql` (per contracts/domain-rpc.md)
- [x] T050 Create regular days off setting component at `src/features/settings/components/RegularDaysOffEditor.tsx` (요일 멀티선택 + 즉시 저장)
- [x] T051 [P] Create domain function `src/lib/domain/regular-days-off.ts` with helpers: `isRegularDayOff(date, daysOff)`, `excludeFromAverage(samples, daysOff)`, `applyChangeSnapshot(...)` per FR-040~045
- [x] T052 [P] Write unit test `tests/unit/regular-days-off.test.ts` covering: 요일 검사, 누락/푸시/예측 제외, 변경 snapshot, 예외 영업

### TanStack Query + Zustand 셋업

- [x] T053 [P] Create TanStack Query client provider at `src/lib/query-client.ts` and `src/components/providers/QueryProvider.tsx`; mount in root layout
- [x] T054 [P] Create Zustand store skeleton at `src/stores/sale-draft.ts` for sale form 임시저장 (페르소나 마감 후 입력 보호)

### RLS 통합 테스트 (헌법 IV 가드)

- [x] T055 [P] Write integration test `tests/integration/rls.test.ts` verifying cross-user SELECT/INSERT/UPDATE/DELETE rejection on all domain tables (users, ingredients, ingredient_price_history)
- [x] T056 [P] Add helper for integration tests: `tests/helpers/test-supabase.ts` with `createTestUser()`, `cleanupTestUser()`, `signInAs()`

**Checkpoint**: Foundation ready — auth 동작, RLS 격리 검증, 5탭 네비게이션 표시, 정기휴무 등록·저장 가능

---

## Phase 3: User Story 3 — 메뉴/레시피 등록 및 단가 추적 (Priority: P3) ★ 의존성 최우선

**Goal**: 사장님이 메뉴/레시피를 등록하고, 빙수카페 템플릿으로 8종 일괄 등록한 뒤 메뉴별 마진(재료 원가 기준)을 본다.

**Independent Test**: 신규 사용자가 메뉴 화면에서 빙수카페 템플릿을 불러오면 메뉴 8개 + 레시피 등록 → 한 메뉴 선택 시 재료별 평균 단가 + 메뉴 원가 + 마진율이 "재료 원가 기준 (이동평균법)" 라벨과 함께 표시된다.

### 도메인 로직 (테스트 우선)

- [ ] T057 [P] [US3] Write unit test `tests/unit/margin.test.ts` for menu cost/margin calculation: `calculateMenuCost(recipe, ingredientPrices)`, `calculateMargin(price, cost)` with label assertion
- [ ] T058 [US3] Implement domain function `src/lib/domain/margin.ts` to satisfy T057 unit tests; uses Decimal.js for precision
- [ ] T059 [P] [US3] Write unit test `tests/unit/pricing.test.ts` for weighted moving average: 30-day scenario, first purchase (stock=0), accumulated precision ≤ 0.01원 (SC-009)
- [ ] T060 [US3] Implement domain function `src/lib/domain/pricing.ts` with `computeNewWeightedAverage(currentStock, currentAvg, newQty, newPrice)` to satisfy T059

### 데이터 모델 + RPC

- [ ] T061 [US3] Write SQL migration `supabase/migrations/003_menus_and_recipes.sql` creating `menus` (with unique `(user_id, name)`), `recipe_items` tables and RLS policies (per data-model.md §6)
- [ ] T062 [US3] Write SQL migration `supabase/migrations/012_clone_menu_template_rpc.sql` defining `clone_menu_template(store_type)` function that inserts ingredients + menus + recipe items from `menu_templates` (per contracts/domain-rpc.md)
- [ ] T063 [US3] Write SQL migration `supabase/migrations/013_menu_templates_seed.sql` creating read-only `menu_templates` table and seeding 빙수카페 8종, 카페 음료 10종 with default recipes
- [ ] T064 [US3] Regenerate types: `npm run db:gen-types > src/lib/supabase/types.ts`
- [ ] T065 [US3] Write Zod schemas at `src/features/menu/schemas.ts` for `MenuInput`, `RecipeItemInput`, `CloneTemplateInput`

### UI 컴포넌트 + 라우팅

- [ ] T066 [P] [US3] Create `src/features/menu/components/MenuList.tsx` listing user menus with margin badge (재료 원가 기준 라벨 포함)
- [ ] T067 [P] [US3] Create `src/features/menu/components/MenuDetailCard.tsx` showing recipe items + 재료별 단가 + 메뉴원가 + 마진율 with 변동 표시 (FR-058 ±5% indicator)
- [ ] T068 [P] [US3] Create `src/features/menu/components/MenuForm.tsx` for create/edit (name unique 검증, recipe items 추가/삭제)
- [ ] T069 [P] [US3] Create `src/features/menu/components/TemplateLoadDialog.tsx` showing template preview + "불러오기" button
- [ ] T070 [US3] Create page `src/app/(main)/menu/page.tsx` integrating MenuList + TemplateLoadDialog (cold-start: empty list + prominent template CTA)
- [ ] T071 [US3] Create page `src/app/(main)/menu/[id]/page.tsx` integrating MenuDetailCard
- [ ] T072 [US3] Create page `src/app/(main)/menu/new/page.tsx` integrating MenuForm
- [ ] T073 [P] [US3] Create hook `src/features/menu/hooks/useMenus.ts` (TanStack Query for menu list + invalidation on save)
- [ ] T074 [P] [US3] Create hook `src/features/menu/hooks/useCloneTemplate.ts` (mutation calling `clone_menu_template` RPC)

### GA4 이벤트

- [ ] T075 [US3] Wire `first_menu_registered` GA4 event in MenuForm save handler (fire only if user's menu count was 0 before this save)
- [ ] T076 [US3] Wire `template_loaded` GA4 event in TemplateLoadDialog success with `store_type` parameter

### 통합 테스트

- [ ] T077 [P] [US3] Write integration test `tests/integration/menu-template.test.ts` verifying `clone_menu_template` creates correct menus + recipes + ingredients without unique violations
- [ ] T078 [P] [US3] Add to `tests/integration/rls.test.ts`: menus/recipe_items cross-user isolation cases

**Checkpoint**: 메뉴 등록 + 템플릿 + 마진 계산 표시 동작. 단, 재료 단가 모두 0원이라 마진 100%로 표시됨 (정상). Phase 4·5 후 실제 단가 반영.

---

## Phase 4: User Story 1 — 마감 후 판매 일괄 입력 (Priority: P1) ★ MVP 첫 검증 지점

**Goal**: 사장님이 마감 후 5분 안에 메뉴별 판매량 입력 + 실시간 마진 확인 + 저장 시 재료 차감 + 7일 이내 편집 가능.

**Independent Test**: 메뉴/레시피 등록된 상태에서 판매 화면 진입 → +/- 입력 → 매출/원가/순수익 실시간 갱신("재료 원가 기준 (이동평균법)" 라벨) → 저장 시 재료 차감 + 메뉴 원가 스냅샷 보존.

### 도메인 로직 (테스트 우선)

- [ ] T079 [P] [US1] Write unit test `tests/unit/snapshot.test.ts` for sale snapshot: `createSaleSnapshot(items, ingredients)`, `recomputeOnEdit(...)`, 7-day lock detection
- [ ] T080 [US1] Implement domain function `src/lib/domain/snapshot.ts` to satisfy T079; uses pricing.ts and margin.ts

### 데이터 모델 + RPC

- [ ] T081 [US1] Write SQL migration `supabase/migrations/004_sales_with_snapshot.sql` creating `sales` (with `is_locked` generated column) + `sale_items` (with `menu_cost_snapshot`, `unit_price`) + RLS (per data-model.md §7)
- [ ] T082 [US1] Write SQL migration `supabase/migrations/007_sale_edit_history.sql` creating `sale_edit_history` (JSONB before/after) + RLS (per data-model.md §8)
- [ ] T083 [US1] Write SQL migration `supabase/migrations/014_save_sale_rpc.sql` defining `save_sale(items)` transactional RPC that validates menus, computes snapshots, decrements stock, returns `SaveSaleResult` with `marginLabel: '재료 원가 기준 (이동평균법)'` (per contracts/domain-rpc.md)
- [ ] T084 [US1] Write SQL migration `supabase/migrations/015_edit_sale_rpc.sql` defining `edit_sale(sale_id, new_items, reason)` with lock check, audit history, stock revert+reapply
- [ ] T085 [US1] Write SQL migration `supabase/migrations/016_delete_sale_rpc.sql` defining `delete_sale(sale_id)` with audit + stock revert
- [ ] T086 [US1] Regenerate types: `npm run db:gen-types > src/lib/supabase/types.ts`
- [ ] T087 [US1] Write Zod schemas at `src/features/sale/schemas.ts` for `SaveSaleInput`, `EditSaleInput` (per contracts/domain-rpc.md)

### UI 컴포넌트 + 라우팅

- [ ] T088 [P] [US1] Create `src/features/sale/components/MenuRow.tsx` with +/- buttons (큼직), direct number input, auto-hide on quantity 0
- [ ] T089 [P] [US1] Create `src/features/sale/components/StickyTotalCard.tsx` showing 매출/원가/순수익 with "재료 원가 기준 (이동평균법)" label, real-time updates from form state
- [ ] T090 [P] [US1] Create `src/features/sale/components/SaleInputForm.tsx` integrating MenuRow list (sorted by 7-day favorites) + StickyTotalCard + date picker (today + 7-day retroactive)
- [ ] T091 [P] [US1] Create `src/features/sale/components/SaleEditDialog.tsx` for editing existing sale with reason input + 7-day lock check
- [ ] T092 [US1] Create page `src/app/(main)/sale/page.tsx` integrating SaleInputForm
- [ ] T093 [US1] Create page `src/app/(main)/sale/[date]/page.tsx` for retroactive input (date param) and view/edit existing sale
- [ ] T094 [P] [US1] Create hook `src/features/sale/hooks/useSaleSubmit.ts` (mutation calling `save_sale` RPC + cache invalidation)
- [ ] T095 [P] [US1] Create hook `src/features/sale/hooks/useFavoriteMenus.ts` (TanStack Query: 지난 7일 판매량 기준 정렬, FR-009)
- [ ] T096 [P] [US1] Create hook `src/features/sale/hooks/useSaleEdit.ts` (mutation for `edit_sale` and `delete_sale`)

### GA4 이벤트

- [ ] T097 [US1] Wire `first_sale_input` GA4 event in save handler (fire only if user's sale count was 0 before)
- [ ] T098 [US1] Wire `daily_sale_input` GA4 event in save handler with `date` parameter
- [ ] T099 [US1] Wire `retroactive_sale_complete` GA4 event when saved date < today (확인: 어제 이전)
- [ ] T100 [US1] Wire `sale_edited` GA4 event in edit handler (within 7-day window)

### 통합 테스트

- [ ] T101 [P] [US1] Write integration test `tests/integration/sale-save.test.ts` verifying `save_sale` transaction: menu cost snapshot stored, stock decremented, RLS isolated
- [ ] T102 [P] [US1] Write integration test `tests/integration/sale-edit.test.ts` verifying lock (>7일 reject), stock revert+reapply, audit history insertion, new snapshot on edit
- [ ] T103 [P] [US1] Add to `tests/integration/rls.test.ts`: sales/sale_items/sale_edit_history cross-user isolation cases

**Checkpoint**: ★ MVP 첫 검증 지점 — 가입 → 메뉴 → 판매 입력 → 마진 확인 흐름 완전 동작. 페르소나 골든패스 5분 통과 가능 (단, purchase 없이는 모든 단가 0이라 마진 100%).

---

## Phase 5: User Story 2 — 거래명세서 받고 매입 입력 (Priority: P2)

**Goal**: 매입 등록 + 가중 이동 평균법 단가 갱신 + ±5% 변동 알림 + 변동 이력 기록.

**Independent Test**: 매입 화면에서 거래처/재료/수량/금액 입력 → 저장 시 평균 단가 가중 갱신 + 재고 증가 + 직전 단가 대비 ±5% 변동 시 알림 표시.

### 데이터 모델 + RPC

- [ ] T104 [US2] Write SQL migration `supabase/migrations/005_purchases_and_history.sql` creating `vendors`, `purchase_orders`, `purchase_order_items` + RLS (per data-model.md §4-5)
- [ ] T105 [US2] Write SQL migration `supabase/migrations/017_save_purchase_rpc.sql` defining `save_purchase(payload)` transactional RPC: validate, save, apply weighted moving average via `pricing.ts` logic in PL/pgSQL, increment stock, insert price history, return `priceChangeAlerts` for ±5% changes
- [ ] T106 [US2] Regenerate types: `npm run db:gen-types > src/lib/supabase/types.ts`
- [ ] T107 [US2] Write Zod schemas at `src/features/purchase/schemas.ts` for `SavePurchaseInput` and vendor management

### UI 컴포넌트 + 라우팅

- [ ] T108 [P] [US2] Create `src/features/purchase/components/PurchaseForm.tsx` (vendor select with autocomplete + 신규 추가, date picker, items list with ingredient autocomplete + 수량/금액)
- [ ] T109 [P] [US2] Create `src/features/purchase/components/VendorQuickCreate.tsx` for inline vendor add (name + lead_time_days, default 1)
- [ ] T110 [P] [US2] Create `src/features/purchase/components/IngredientQuickCreate.tsx` for inline ingredient add (name + unit, name unique check)
- [ ] T111 [P] [US2] Create `src/features/purchase/components/PriceChangeAlertList.tsx` showing ±5% alerts after save with previous→new price + percent
- [ ] T112 [US2] Create page `src/app/purchase/page.tsx` (context-entry, not in bottom tab) integrating PurchaseForm
- [ ] T113 [US2] Add quick-action entry from `src/app/(main)/inventory/page.tsx` linking to `/purchase` (header action button per design system patterns)
- [ ] T114 [P] [US2] Create hook `src/features/purchase/hooks/usePurchaseSubmit.ts` (mutation calling `save_purchase` RPC + invalidate menus/ingredients caches)
- [ ] T115 [P] [US2] Create hook `src/features/purchase/hooks/useVendors.ts` and `useIngredients.ts` (TanStack Query)

### GA4 이벤트

- [ ] T116 [US2] Wire `first_purchase_logged` GA4 event in save handler (fire only if user's purchase count was 0 before)
- [ ] T117 [US2] Wire `price_change_alert_shown` GA4 event when PriceChangeAlertList renders ≥1 alert

### 통합 테스트

- [ ] T118 [P] [US2] Write integration test `tests/integration/purchase-flow.test.ts` verifying weighted average correctness across multiple purchases, first-purchase (stock=0) edge case, history record reason='purchase', menu margin auto-recompute
- [ ] T119 [P] [US2] Add to `tests/integration/rls.test.ts`: vendors/purchase_orders/purchase_order_items cross-user cases

**Checkpoint**: 가중 평균 단가 적용 → 메뉴 마진이 실제 값으로 표시. 페르소나 골든패스가 의미 있는 마진율을 보여줌 (예: 딸기빙수 77%).

---

## Phase 6: User Story 4 — 재료 소진 예측 및 발주 알림 (Priority: P4)

**Goal**: 재료 화면에서 소진 예상일 표시 + 발주 알림 푸시 + 주간 실사 알림 + 손실액 계산 + 사용량 급증 배지.

**Independent Test**: 7일+ 판매 데이터 누적된 사용자가 재료 화면 진입 → 각 재료의 예상 소진일 + 상태(안전/주의/발주/소진) 표시 → 발주 필요 상태에서 다음날 09:00 푸시 발송.

### 도메인 로직 (테스트 우선)

- [ ] T120 [P] [US4] Write unit test `tests/unit/forecast.test.ts` covering: 요일별 가중 평균, 거래처 리드타임, 안전여유 1일, 콜드스타트(7일 이내), ±20% 급증 감지, 정기휴무 제외 (with synthetic 10+ scenarios per research R4)
- [ ] T121 [US4] Implement domain function `src/lib/domain/forecast.ts` to satisfy T120; consumes regular-days-off helpers

### 데이터 모델 + RPC

- [ ] T122 [US4] Write SQL migration `supabase/migrations/006_stock_counts.sql` creating `daily_stock_counts`, `stock_count_items` + RLS (per data-model.md §9)
- [ ] T123 [US4] Write SQL migration `supabase/migrations/018_apply_stock_count_rpc.sql` defining `apply_stock_count(items)` updating `current_stock` only (단가 불변, FR-016), inserting `IngredientPriceHistory` reason='stock_count_correction'
- [ ] T124 [US4] Write SQL migration `supabase/migrations/019_get_depletion_forecast_rpc.sql` defining `get_depletion_forecast()` returning per-ingredient status + expected_depletion_date + trend (uses forecast.ts logic ported to PL/pgSQL OR returns raw data for client-side computation — choose latter for simpler testing)
- [ ] T125 [US4] Regenerate types: `npm run db:gen-types > src/lib/supabase/types.ts`
- [ ] T126 [US4] Write Zod schemas at `src/features/inventory/schemas.ts`

### UI 컴포넌트 + 라우팅

- [ ] T127 [P] [US4] Create `src/features/inventory/components/IngredientStatusList.tsx` grouped by status (🔴 발주 필요 / 🟡 주의 / 🟢 안전) with expected depletion date and trend badges
- [ ] T128 [P] [US4] Create `src/features/inventory/components/ColdStartNotice.tsx` (가입 후 7일 이내 안내, FR-018)
- [ ] T129 [P] [US4] Create `src/features/inventory/components/StockCountForm.tsx` (재료별 실재고 입력 + diff 미리보기 + weekly_loss_amount 표시)
- [ ] T130 [P] [US4] Create `src/features/inventory/components/StockCountResultCard.tsx` showing applied corrections + weekly loss
- [ ] T131 [US4] Create page `src/app/(main)/inventory/page.tsx` integrating IngredientStatusList + cold-start gate + quick-action to purchase
- [ ] T132 [US4] Create page `src/app/(main)/inventory/stock-count/page.tsx` integrating StockCountForm
- [ ] T133 [P] [US4] Create hook `src/features/inventory/hooks/useDepletionForecast.ts` (TanStack Query, fetches `get_depletion_forecast` then runs forecast.ts client-side for status classification)
- [ ] T134 [P] [US4] Create hook `src/features/inventory/hooks/useApplyStockCount.ts` (mutation)

### 푸시 인프라

- [ ] T135 [P] [US4] Write SQL migration `supabase/migrations/020_push_subscriptions_and_rpcs.sql` creating `push_subscriptions` table + `subscribe_push`/`unsubscribe_push` RPCs (per data-model.md §10)
- [ ] T136 [US4] Create push subscription helper at `src/lib/push/client.ts` with `requestPushPermissionAndSubscribe()` (per contracts/push.md client flow)
- [ ] T137 [US4] Wire push permission request in sale save success flow when first_sale_input fires (per R1: first 가치 경험 직후)
- [ ] T138 [US4] Create Supabase Edge Function `supabase/functions/push-scheduler/index.ts` with payload builders for `order_alert`, `closing_reminder`, `stock_count`, `critical_depletion` (per contracts/push.md), excluding regular-day-off users
- [ ] T139 [US4] Configure pg_cron schedules in `supabase/migrations/021_push_cron_schedules.sql`: `0 0 * * *` (KST 09:00 order_alert), `0 13 * * *` (KST 22:00 closing_reminder), `0 22 * * 0` (KST 월 07:00 stock_count)

### GA4 이벤트

- [ ] T140 [US4] Wire `order_alert_received` GA4 event in service worker push handler (`public/sw.js`) sending via fetch to GA4 measurement protocol
- [ ] T141 [US4] Wire `stock_count_completed` GA4 event in StockCountForm success handler
- [ ] T142 [US4] Wire `weekly_loss_displayed` GA4 event in StockCountResultCard render

### 통합 테스트

- [ ] T143 [P] [US4] Write integration test `tests/integration/stock-count.test.ts` verifying `apply_stock_count` updates only quantity (단가 불변), records history with correct reason, computes weekly_loss_amount
- [ ] T144 [P] [US4] Add to `tests/integration/rls.test.ts`: stock_counts/stock_count_items/push_subscriptions cross-user cases
- [ ] T145 [US4] Manual verification: deploy Edge Function to staging, trigger via curl, verify push delivery to test device

**Checkpoint**: 재고 예측 + 푸시 알림 동작. 페르소나가 발주 알림을 실제로 받는 흐름 완성.

---

## Phase 7: User Story 5 — 홈 대시보드 (오늘) (Priority: P5)

**Goal**: 오늘 탭에서 최상단 알림 + 어제 KPI(매출/순수익/마진율 with 라벨) + 메뉴 마진 TOP3 + 마진 낮은 메뉴 원인.

**Independent Test**: 어제 판매 입력된 사용자가 오늘 탭 진입 → 최상단 알림 카드 + 어제 KPI 카드 + TOP3 마진 메뉴 카드 표시.

### 데이터 페칭 RPC

- [ ] T146 [US5] Write SQL migration `supabase/migrations/022_get_today_dashboard_rpc.sql` defining `get_today_dashboard()` returning: alerts (depletion + 유통기한), yesterday KPI (revenue, net_profit, margin_percent, weekday-over-weekday change), top3 menus (week-based margin), low-margin reason

### UI 컴포넌트 + 라우팅

- [ ] T147 [P] [US5] Create `src/features/dashboard/components/AlertsCard.tsx` listing action items (소진 예상, 유통기한 임박)
- [ ] T148 [P] [US5] Create `src/features/dashboard/components/YesterdayKpiCard.tsx` with 매출/순수익/마진율 + "재료 원가 기준 (이동평균법)" label + 지난주 같은 요일 대비 % (FR-020)
- [ ] T149 [P] [US5] Create `src/features/dashboard/components/MarginTop3Card.tsx` listing top 3 by margin% + low-margin menu with cause text (e.g., "딸기값 인상 영향")
- [ ] T150 [P] [US5] Create `src/features/dashboard/components/MissingSaleBadge.tsx` (FR-091, 어제 판매 미입력 시 빨간 배지)
- [ ] T151 [US5] Create page `src/app/(main)/today/page.tsx` integrating dashboard cards (per design system patterns.md "홈" pattern)
- [ ] T152 [P] [US5] Create hook `src/features/dashboard/hooks/useTodayDashboard.ts` (TanStack Query)

### GA4 이벤트

- [ ] T153 [US5] Wire `dashboard_viewed` GA4 event on today page mount

### 검증

- [ ] T154 [US5] Manual UX verification: 페르소나 1분 체크 흐름이 모바일 폭(375px)에서 동작 (헌법 I)

**Checkpoint**: 매일 1분 체크 흐름 완성.

---

## Phase 8: User Story 6 — 월간 캘린더 (월간 장부) (Priority: P6)

**Goal**: 캘린더 탭에서 월간 누적 KPI + 7×6 그리드(매출 인텐시티, 매입/누락 도트) + 누락일 탭 → 소급 입력 + 정기휴무 회색 + 선택일 상세.

**Independent Test**: 한 달 분량 판매·매입 데이터 있는 사용자가 캘린더 탭 진입 → 30일 셀이 인텐시티+도트로 표시 + 누락일 탭 시 해당 날짜 소급 입력 화면 이동.

### 데이터 RPC

- [ ] T155 [US6] Write SQL migration `supabase/migrations/023_get_calendar_month_rpc.sql` defining `get_calendar_month(year, month)` returning month cumulative + per-cell data (per contracts/domain-rpc.md), respecting regular_days_off

### UI 컴포넌트 + 라우팅

- [ ] T156 [P] [US6] Create `src/features/calendar/components/MonthHeader.tsx` (이전/다음 달 nav + 2026년 4월 표시)
- [ ] T157 [P] [US6] Create `src/features/calendar/components/MonthCumulativeCard.tsx` (매출/순수익/일평균/영업일수 + 재료 원가 기준 라벨)
- [ ] T158 [P] [US6] Create `src/features/calendar/components/CalendarGrid.tsx` (7×6 grid, 셀별 인텐시티 + 도트 + 매출 만원 + 미래·가입전·정기휴무 회색 + 누락 2일+ 강조 per design system patterns.md "캘린더")
- [ ] T159 [P] [US6] Create `src/features/calendar/components/CellDetailPanel.tsx` (선택일 상세 — 매출/매입/베스트셀러)
- [ ] T160 [P] [US6] Create `src/features/calendar/components/CalendarLegend.tsx` (인텐시티 5단계 + 매입/누락 도트 설명)
- [ ] T161 [US6] Create page `src/app/(main)/calendar/page.tsx` integrating all calendar components
- [ ] T162 [P] [US6] Create hook `src/features/calendar/hooks/useCalendarMonth.ts` (TanStack Query)

### 누락일 → 소급 입력 흐름

- [ ] T163 [US6] Implement cell click handler in CalendarGrid: 누락일(7일 이내) → router.push(`/sale/${date}`); 7일 초과 → "이미 만료" toast; 미래 → "입력 불가" toast (FR-022~024)

### GA4 이벤트

- [ ] T164 [US6] Wire `calendar_viewed` GA4 event on calendar page mount
- [ ] T165 [US6] Wire `calendar_missing_day_clicked` GA4 event when missing-day cell tapped (D7 funnel 핵심)
- [ ] T166 [US6] Wire `d7_active` GA4 event from server cron in `supabase/functions/d7-tracker/index.ts` (daily checks users at signup_anniversary +7 with active session in last 24h)

**Checkpoint**: 캘린더 완성. 페르소나 월간 장부 시각화 + 누락일 즉시 보정 동선 완성.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 헌법 + 디자인 시스템 + 페르소나 게이트 검증

- [ ] T167 [P] Verify FR-019 라벨 노출: grep `재료 원가 기준 (이동평균법)` in all margin-displaying components; ensure 0 occurrences of plain `순수익` without label (헌법 III, 출시 차단 사유)
- [ ] T168 [P] Verify design token hardcoding 0건: grep for hex codes (`#[0-9a-fA-F]{3,6}`) in `src/` excluding token files; ensure 0 violations (헌법 Design Source)
- [ ] T169 Run E2E persona-golden-path on mobile viewport (375x667) and assert total time ≤ 5 minutes (SC-001/SC-007)
- [ ] T170 Run `npm run test:coverage` and verify Codecov thresholds: domain ≥80% (`src/lib/domain/`, `src/features/*/lib/`), overall ≥60% (헌법 v1.3.0)
- [ ] T171 [P] Run Lighthouse on `/sale` mobile preview (375x667): assert PWA ≥90, Accessibility ≥90, Performance ≥90, Best Practices ≥90
- [ ] T172 Manual verification: PWA install on iOS Safari 16.4+, push permission grant, deliver test push from Edge Function (manual trigger), confirm notification displays
- [ ] T173 Manual verification: GA4 DebugView shows `signup_complete → first_menu_registered → first_sale_input → d7_active` events firing for test user
- [ ] T174 Manual verification: trigger Sentry error in dev (e.g., throw in event handler), confirm captured in Sentry dashboard with source map
- [ ] T175 [P] Deploy Edge Functions to staging via `.github/workflows/deploy-edge-functions.yml`; verify push-scheduler runs and permanent-delete cron registered
- [ ] T176 [P] Verify Korean typography: visual diff against `easystock-design-system/patterns.md` reference (Pretendard rendering, tabular-nums on metrics, units in 보조색·작은 사이즈)
- [ ] T177 [P] Verify CI all jobs green on representative PR; Codecov badge displays current %
- [ ] T178 Verify branch protection: open intentional failing PR (test fail), confirm merge button disabled until fixed
- [ ] T179 [P] Add `README.md` with setup instructions, env var list, common commands (referencing `.env.example` and `docs/setup-{github,vapid}.md`)
- [ ] T180 [P] Update CLAUDE.md "자주 쓰는 명령" 섹션 with finalized scripts (replace placeholder)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음, 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 필요. **모든 user story 시작 차단**
- **US3 menu (Phase 3)**: Foundational 완료 후 시작
- **US1 sale (Phase 4)**: US3 menu 완료 필수 (마진 계산 의존성)
- **US2 purchase (Phase 5)**: US3 menu 완료 후 가능 (재료 단가 갱신 → 메뉴 마진 정확도). 기술적으로 US1과 병렬 가능하지만 순차 권장
- **US4 inventory (Phase 6)**: US1 sale 완료 필수 (판매 데이터 7일+ 누적이 예측 전제). 단, 개발은 US2와 병렬 가능 (mock 데이터로)
- **US5 dashboard (Phase 7)**: US1, US2, US4 완료 후 (모든 데이터 viewer)
- **US6 calendar (Phase 8)**: US1 완료 후 (sale 데이터 viewer). US5와 병렬 가능
- **Polish (Phase 9)**: 모든 user story 완료 후

### 주요 의존성 다이어그램

```text
Setup ─→ Foundational ─→ US3 menu ─┬→ US1 sale ─┬→ US4 inventory ─┐
                                    │            │                  ├→ US5 dashboard ─→ Polish
                                    └→ US2 purchase ───────────────┘
                                                 ↓
                                           (병렬 가능)
                                                 ↓
                                                 └─→ US6 calendar ──→ Polish
```

### User Story Independence Notes

- **US3 (menu)**: 의존성 트리의 뿌리. 다른 스토리에 영향 주지만 자체 독립 검증 가능 (마진율 계산만 단가 0)
- **US1 (sale)**: US3 필요. 자체 독립 검증 가능 (마진은 menu에서)
- **US2 (purchase)**: US3 필요. US1과 직접 의존성 없지만 같이 있어야 마진 정확
- **US4 (inventory)**: US1 데이터 필요. 자체 화면은 독립
- **US5 (dashboard)**: 모든 데이터 의존. 빈 데이터 상태 처리 필요
- **US6 (calendar)**: US1 데이터 의존. US5와 독립

---

## Parallel Opportunities

### Phase 1 Setup

T002~T029 중 동일 file 의존성 없는 [P] 표시 task는 모두 병렬:

- T002, T003, T004, T005, T009, T010, T011, T012, T016, T017, T018, T019, T020 (config files 분리)
- T021~T024, T028~T029 (각자 다른 file)

### Phase 2 Foundational

- T030~T032 (마이그레이션, 순차 추천 — schema 의존)
- T034, T035, T037, T038, T039, T046, T047, T048, T049, T051, T052, T053, T054, T055, T056 (각각 다른 file)

### Phase 3 US3 menu

- T057, T059 (다른 테스트 파일)
- T066~T069, T073, T074 (다른 컴포넌트/훅 파일)
- T077, T078 (다른 통합 테스트 파일)

### Phase 4 US1 sale

- T079 (단위 테스트)
- T088~T091, T094~T096 (다른 컴포넌트/훅)
- T101~T103 (다른 통합 테스트)

### Phase 5 US2 purchase

- T108~T111, T114, T115 (다른 컴포넌트/훅)
- T118, T119 (다른 통합 테스트)

### Phase 6 US4 inventory

- T120 (단위 테스트)
- T127~T130, T133, T134 (다른 컴포넌트/훅)
- T135 (RPC 마이그레이션, 독립 file)
- T143, T144 (다른 통합 테스트)

### Phase 7 US5 dashboard

- T147~T150, T152 (다른 컴포넌트/훅)

### Phase 8 US6 calendar

- T156~T160, T162 (다른 컴포넌트/훅)

### Phase 9 Polish

- T167, T168, T171, T175, T176, T177, T179, T180 (각자 다른 검증/문서)

---

## Implementation Strategy

### MVP First (Phase 1 → 4)

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 US3 menu
4. **Phase 4 US1 sale** ★ STOP and VALIDATE
   - 페르소나 골든패스 5분 통과 (with menu only, 단가 0)
   - 핵심 도메인 단위 테스트 통과 (pricing, margin, snapshot)
   - RLS 통합 테스트 통과
   - 디자인 시스템 토큰 적용 확인
   - 가입 → 메뉴 → 판매 → 마진 흐름 가능
5. (이 시점에 사장님에게 데모 가능 — 매입 없이도 메뉴/판매 흐름은 동작)

### Incremental Delivery

```
MVP (Phase 4 완료) ─→ + 매입 (Phase 5) ─→ 마진 정확도 ↑
                  ─→ + 재료 (Phase 6) ─→ 핵심 가치(소진 알림) 활성
                  ─→ + 대시보드 (Phase 7) ─→ 1분 체크 흐름
                  ─→ + 캘린더 (Phase 8) ─→ 월간 시각화
                  ─→ Polish (Phase 9) ─→ 출시 준비
```

각 Phase 완료 후 로컬 검증 + 단위 테스트 통과 + Codecov 임계치 유지 → 다음 Phase 진입.

### 1인 개발자 권장 일정 (참고)

| Phase           | 예상 소요                       |
| --------------- | ------------------------------- |
| 1 Setup         | 2~3일                           |
| 2 Foundational  | 3~4일                           |
| 3 US3 menu      | 3~4일                           |
| 4 US1 sale      | 4~5일 (가장 복잡 — 편집/스냅샷) |
| 5 US2 purchase  | 2~3일                           |
| 6 US4 inventory | 4~5일 (forecast + push)         |
| 7 US5 dashboard | 2일                             |
| 8 US6 calendar  | 3일                             |
| 9 Polish        | 2~3일                           |
| **총합**        | **약 25~32일** (일 6~8시간)     |

---

## Notes

- [P] task = 다른 file, 의존성 없음 (병렬 안전)
- [Story] 라벨이 task → user story 추적성 보장
- 각 user story는 자체 검증 가능
- 핵심 도메인 함수는 테스트 우선 작성 (TDD-light, 헌법 v1.3.0)
- 각 task 완료 시 또는 논리 그룹 단위로 commit (`feat(scope): ...` 형식)
- 각 checkpoint에서 수동 검증 후 다음 phase 진입 (Phase Validation, 헌법 Development Workflow)
- 같은 file 내 task 충돌 회피, cross-story 의존성 최소화
