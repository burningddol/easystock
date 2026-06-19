# Phase 1 Data Model: MVP 핵심

**Date**: 2026-04-30
**Plan**: [plan.md](./plan.md)
**Spec entities**: spec.md `Key Entities` 섹션 기반

10개 엔티티 + RLS 정책 + 상태 전이 + 검증 규칙 명시. Postgres 스키마 의도이며 SQL 마이그레이션은 `supabase/migrations/`에 작성 (Phase 1+ 작업).

---

## ER 개요

```
User 1 ─┬─ N Ingredient
        ├─ N IngredientPriceHistory
        ├─ N Vendor
        ├─ N PurchaseOrder ─ N PurchaseOrderItem ─ 1 Ingredient
        ├─ N Menu ─ N RecipeItem ─ 1 Ingredient
        ├─ N Sale ─ N SaleItem ─ 1 Menu
        │              └ menu_cost_snapshot (JSONB)
        ├─ N SaleEditHistory ─ 1 Sale
        ├─ N DailyStockCount ─ N StockCountItem ─ 1 Ingredient
        └─ N PushSubscription
```

모든 도메인 테이블은 `user_id uuid not null` + RLS 정책 `(auth.uid() = user_id)`.

---

## 1. User (사장님)

Supabase Auth의 `auth.users`를 확장. 별도 `public.users` 테이블에 도메인 필드 추가.

### Fields

| 필드 | 타입 | 제약 | 비고 |
|---|---|---|---|
| id | uuid (PK, FK auth.users.id) | NOT NULL | Supabase Auth 사용자 ID와 1:1 |
| email | text | unique, NOT NULL | auth.users에서 동기화 |
| store_name | text | NOT NULL | 가게 이름 |
| store_type | enum('bingsu_cafe', 'cafe', 'dessert_cafe') | NOT NULL | 가게유형 |
| regular_days_off | text[] | DEFAULT '{}' | 정기휴무 요일. 값 예: `{'MON', 'TUE'}` (ISO 요일 약어). 빈 배열 = 365일 영업 |
| signed_up_at | timestamptz | NOT NULL, default now() | 가입일 (콜드스타트 7일 계산 기준) |
| withdrawal_requested_at | timestamptz | NULL | 탈퇴 신청일 (grace period 시작) |
| permanent_delete_at | timestamptz | NULL | 영구 삭제 예정일 (= withdrawal_requested_at + 30일) |
| analytics_consent | boolean | DEFAULT false | GA4 쿠키 동의 상태 (PIPA) |
| created_at, updated_at | timestamptz | NOT NULL | 표준 |

### Validation

- `regular_days_off` 값은 `{MON,TUE,WED,THU,FRI,SAT,SUN}` 중 부분집합 (CHECK)
- `withdrawal_requested_at IS NULL ↔ permanent_delete_at IS NULL` (CHECK)
- `permanent_delete_at = withdrawal_requested_at + interval '30 days'` (트리거로 자동 설정)

### State Transitions

```
ACTIVE  ──[탈퇴 신청]──>  GRACE_PERIOD  ──[30일 경과]──>  PERMANENTLY_DELETED
                              │
                              └─[복구]──>  ACTIVE
```

- ACTIVE: `withdrawal_requested_at IS NULL`
- GRACE_PERIOD: `withdrawal_requested_at IS NOT NULL AND now() < permanent_delete_at`. 로그인 차단, 데이터 보존
- PERMANENTLY_DELETED: `now() >= permanent_delete_at`. Edge Function `permanent-delete`가 cascade 삭제

### RLS

```sql
-- SELECT: 본인만
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);
-- UPDATE: 본인만, withdrawal_requested_at NULL → 신청 가능 / NOT NULL → 복구만
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);
-- INSERT: 가입 트리거에서만 (auth.users → public.users 자동 동기화)
-- DELETE: Edge Function service role만
```

### 관련 spec FR

- FR-001 가게 정보 등록
- FR-002 사용자별 데이터 격리
- FR-034~037 탈퇴 + grace period
- FR-040 정기휴무 등록
- FR-044 정기휴무 변경 변경일 이후 적용

---

## 2. Ingredient (재료)

### Fields

| 필드 | 타입 | 제약 | 비고 |
|---|---|---|---|
| id | uuid (PK) | DEFAULT uuid_generate_v4() | |
| user_id | uuid (FK users.id) | NOT NULL | RLS 격리 |
| name | text | NOT NULL | 재료 이름 |
| unit | enum('g', 'ml', 'piece') | NOT NULL | 단위 (변경 불가) |
| current_stock | numeric(12,3) | NOT NULL DEFAULT 0 | 현재 재고량 (음수 시 0으로 보정 + 경고) |
| current_avg_price | numeric(12,4) | NOT NULL DEFAULT 0 | 현재 평균 단가 (가중 이동 평균) |
| expiry_date | date | NULL | 유통기한 (선택, 1차 MVP는 단일 값) |
| is_active | boolean | DEFAULT true | 비활성 = 메뉴에서 사용 가능하지만 신규 매입 차단 |
| created_at, updated_at | timestamptz | NOT NULL | |

### Validation

- `name` per-user unique (FR-038): `UNIQUE (user_id, name)`
- `current_stock >= 0` 트리거로 0 보정 (음수 시 자동 0 + 경고 로그)
- `unit` 변경 불가 — 변경 시도 시 트리거에서 reject

### Indexes

- `(user_id, name)` unique
- `(user_id, is_active)` for 활성 목록 조회

### RLS

```sql
CREATE POLICY "ingredients_isolated" ON public.ingredients
  USING (auth.uid() = user_id);
```
(SELECT/INSERT/UPDATE/DELETE 모두 동일 정책)

### 관련 spec FR

- FR-002 격리, FR-038 이름 unique

---

## 3. IngredientPriceHistory (재료 단가 이력)

매입·실사 보정 등으로 평균 단가 또는 재고가 바뀐 모든 사건 기록.

### Fields

| 필드 | 타입 | 제약 | 비고 |
|---|---|---|---|
| id | uuid (PK) | | |
| user_id | uuid (FK) | NOT NULL | |
| ingredient_id | uuid (FK ingredients.id) | NOT NULL | |
| changed_at | timestamptz | NOT NULL | 변경 시점 |
| previous_avg_price | numeric(12,4) | NOT NULL | 직전 평균 단가 |
| new_avg_price | numeric(12,4) | NOT NULL | 신규 평균 단가 |
| previous_stock | numeric(12,3) | NOT NULL | 직전 재고량 |
| new_stock | numeric(12,3) | NOT NULL | 신규 재고량 |
| reason | enum('purchase', 'stock_count_correction', 'sale_consumption', 'sale_edit_revert', 'sale_edit_apply') | NOT NULL | |
| reference_id | uuid | NULL | 매입·실사·판매 레코드 ID (외래키 아님, FK 무결성보다 이력 보존 우선) |

### RLS

```sql
CREATE POLICY "price_history_isolated" ON public.ingredient_price_history
  USING (auth.uid() = user_id);
```

INSERT는 RPC 함수에서만 (트리거 또는 명시 호출).

### 관련 spec FR

- FR-029 변동 이력 기록

---

## 4. Vendor (거래처)

### Fields

| 필드 | 타입 | 제약 | 비고 |
|---|---|---|---|
| id | uuid (PK) | | |
| user_id | uuid (FK) | NOT NULL | |
| name | text | NOT NULL | 거래처 이름 |
| lead_time_days | integer | NOT NULL DEFAULT 1 | 리드타임 (기본 1일) |
| is_active | boolean | DEFAULT true | |
| created_at, updated_at | timestamptz | NOT NULL | |

### Validation

- `name` per-user unique: `UNIQUE (user_id, name)`
- `lead_time_days >= 0`

### RLS

```sql
CREATE POLICY "vendors_isolated" ON public.vendors
  USING (auth.uid() = user_id);
```

### 관련 spec FR

- FR-038 이름 unique, edge case "거래처 리드타임 미설정 → 기본 1일"

---

## 5. PurchaseOrder (매입) + PurchaseOrderItem

### PurchaseOrder Fields

| 필드 | 타입 | 제약 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | NOT NULL |
| vendor_id | uuid (FK vendors.id) | NOT NULL |
| purchased_at | date | NOT NULL |
| total_amount | numeric(14,2) | NOT NULL DEFAULT 0 |
| created_at | timestamptz | NOT NULL |

### PurchaseOrderItem Fields

| 필드 | 타입 | 제약 |
|---|---|---|
| id | uuid (PK) | |
| purchase_order_id | uuid (FK) | NOT NULL CASCADE |
| user_id | uuid (FK) | NOT NULL (RLS 적용) |
| ingredient_id | uuid (FK) | NOT NULL |
| quantity | numeric(12,3) | NOT NULL CHECK > 0 |
| amount | numeric(14,2) | NOT NULL CHECK >= 0 |
| unit_price | numeric(12,4) | NOT NULL (= amount / quantity, generated column) |

### RLS

각 테이블에 `auth.uid() = user_id`. PurchaseOrderItem도 `user_id` 직접 가짐 (RLS 단순화).

### Trigger / RPC

- RPC `save_purchase(...)`가 트랜잭션으로:
  1. PurchaseOrder + items 저장
  2. 각 ingredient에 가중 이동 평균법 적용 → `current_avg_price` 갱신
  3. `current_stock` 증가
  4. `IngredientPriceHistory` 레코드 추가 (reason='purchase')
  5. ±5% 변동 시 응답에 `priceChangeAlert: true` 포함

### 관련 spec FR

- FR-004 가중 이동 평균법, FR-005 ±5% 변동 알림, FR-029 이력

---

## 6. Menu (메뉴) + RecipeItem (레시피 항목)

### Menu Fields

| 필드 | 타입 | 제약 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | NOT NULL |
| name | text | NOT NULL |
| price | numeric(10,2) | NOT NULL CHECK >= 0 |
| is_active | boolean | DEFAULT true |
| created_at, updated_at | timestamptz | NOT NULL |

### RecipeItem Fields

| 필드 | 타입 | 제약 |
|---|---|---|
| id | uuid (PK) | |
| menu_id | uuid (FK) | NOT NULL CASCADE |
| user_id | uuid (FK) | NOT NULL (RLS) |
| ingredient_id | uuid (FK) | NOT NULL |
| quantity_per_serving | numeric(12,3) | NOT NULL CHECK > 0 |

### Validation

- Menu `name` per-user unique: `UNIQUE (user_id, name)` (활성·비활성 무관)
- RecipeItem `(menu_id, ingredient_id)` unique (한 메뉴에 같은 재료 중복 등록 금지)

### Computed

- 메뉴 원가(현재 시점) = `Σ (recipe_item.quantity × ingredient.current_avg_price)` — 클라이언트/RPC에서 계산
- 마진율 = `(price - 메뉴 원가) / price × 100` — UI 표시 시 항상 "재료 원가 기준 (이동평균법)" 라벨 동반 (FR-019)

### RLS

```sql
CREATE POLICY "menus_isolated" ON public.menus USING (auth.uid() = user_id);
CREATE POLICY "recipe_items_isolated" ON public.recipe_items USING (auth.uid() = user_id);
```

### 관련 spec FR

- FR-003 템플릿 (seed에서 8/10종 제공), FR-019 라벨, FR-038 unique

---

## 7. Sale (판매) + SaleItem

### Sale Fields

| 필드 | 타입 | 제약 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | NOT NULL |
| sold_at | date | NOT NULL |
| total_revenue | numeric(14,2) | NOT NULL DEFAULT 0 |
| total_cost_snapshot | numeric(14,4) | NOT NULL DEFAULT 0 |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |
| is_locked | boolean | NOT NULL DEFAULT false (generated: `now() - created_at > interval '7 days'`) |

### SaleItem Fields

| 필드 | 타입 | 제약 |
|---|---|---|
| id | uuid (PK) | |
| sale_id | uuid (FK) | NOT NULL CASCADE |
| user_id | uuid (FK) | NOT NULL (RLS) |
| menu_id | uuid (FK) | NOT NULL |
| quantity | integer | NOT NULL CHECK > 0 |
| unit_price | numeric(10,2) | NOT NULL | 판매 시점 메뉴 가격 (스냅샷) |
| menu_cost_snapshot | numeric(14,4) | NOT NULL | 판매 시점 메뉴 1개 원가 (= Σ recipe × ingredient.current_avg_price 그 시점) |

### Validation

- `(sale_id, menu_id)` unique (한 판매에 같은 메뉴 중복 행 금지) — 아니면 sum 처리 가능. 1차 MVP는 unique로 단순화
- 7일 초과 Sale은 `is_locked = true` (편집/삭제 차단, FR-030/FR-024)

### RPC

- `save_sale(items: SaleItemInput[])`:
  1. 각 항목 메뉴 원가 계산 (현재 평균 단가 기준)
  2. Sale + items + snapshot 저장
  3. 재료 자동 차감 (`current_stock -= recipe × quantity`)
  4. `IngredientPriceHistory` 추가 (reason='sale_consumption', new_avg_price = previous_avg_price)
- `edit_sale(sale_id, new_items)`:
  1. `is_locked` 체크, true면 reject
  2. 기존 SaleEditHistory 레코드 추가 (변경 전 스냅샷)
  3. 기존 항목 재고 되돌림 + `IngredientPriceHistory` reason='sale_edit_revert'
  4. 새 항목 + 새 스냅샷 저장
  5. 새 항목 재고 차감 + reason='sale_edit_apply'
- `delete_sale(sale_id)`: 논리적으로 모든 items 삭제로 처리

### RLS

```sql
CREATE POLICY "sales_isolated" ON public.sales USING (auth.uid() = user_id);
CREATE POLICY "sale_items_isolated" ON public.sale_items USING (auth.uid() = user_id);
```

### 관련 spec FR

- FR-006~011 입력, FR-030~033 편집

---

## 8. SaleEditHistory (판매 편집 이력)

### Fields

| 필드 | 타입 | 제약 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | NOT NULL |
| sale_id | uuid (FK sales.id) | NOT NULL |
| changed_at | timestamptz | NOT NULL DEFAULT now() |
| change_type | enum('edit', 'delete') | NOT NULL |
| reason | text | NULL | 편집 사유 (선택 입력) |
| before_items | jsonb | NOT NULL | 변경 전 항목 스냅샷 |
| after_items | jsonb | NULL | 변경 후 항목 스냅샷 (delete의 경우 NULL) |

### RLS

```sql
CREATE POLICY "sale_edit_history_isolated" ON public.sale_edit_history
  USING (auth.uid() = user_id);
```

INSERT는 RPC `edit_sale` / `delete_sale`에서만.

### 관련 spec FR

- FR-031 편집 이력

---

## 9. DailyStockCount (재고 실사) + StockCountItem

### DailyStockCount Fields

| 필드 | 타입 | 제약 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | NOT NULL |
| counted_at | date | NOT NULL |
| created_at | timestamptz | NOT NULL |

### StockCountItem Fields

| 필드 | 타입 | 제약 |
|---|---|---|
| id | uuid (PK) | |
| stock_count_id | uuid (FK) | NOT NULL CASCADE |
| user_id | uuid (FK) | NOT NULL |
| ingredient_id | uuid (FK) | NOT NULL |
| actual_stock | numeric(12,3) | NOT NULL CHECK >= 0 |
| system_stock_at_count | numeric(12,3) | NOT NULL | 실사 시점 시스템 재고 (스냅샷) |
| weekly_loss_amount | numeric(14,4) | NOT NULL | (system - actual) × current_avg_price |

### RPC

- `apply_stock_count(items)`:
  1. 각 ingredient `current_stock = actual_stock` (수량만 보정, 평균 단가 변경 없음 — FR-016)
  2. `IngredientPriceHistory` 추가 (reason='stock_count_correction', new_avg_price = previous_avg_price)

### RLS

```sql
CREATE POLICY "stock_counts_isolated" ON public.daily_stock_counts USING (auth.uid() = user_id);
CREATE POLICY "stock_count_items_isolated" ON public.stock_count_items USING (auth.uid() = user_id);
```

### 관련 spec FR

- FR-015 실사 알림, FR-016 수량만, FR-017 손실액 표시, FR-028 차이 확인

---

## 10. PushSubscription (PWA 푸시 구독)

### Fields

| 필드 | 타입 | 제약 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | NOT NULL |
| endpoint | text | NOT NULL UNIQUE | 브라우저 push endpoint |
| keys_p256dh | text | NOT NULL | |
| keys_auth | text | NOT NULL | |
| user_agent | text | NULL | 디버깅용 |
| created_at | timestamptz | NOT NULL | |
| last_used_at | timestamptz | NULL | |

### Validation

- `endpoint` 글로벌 unique (다른 사용자가 같은 엔드포인트 가질 수 없음 — 브라우저 endpoint는 고유)

### RLS

```sql
CREATE POLICY "push_subscriptions_isolated" ON public.push_subscriptions USING (auth.uid() = user_id);
```

### 관련 spec FR

- FR-013/014/015 푸시 발송 (Edge Function이 service role로 조회)

---

## 가게유형별 메뉴 템플릿 (Seed)

`supabase/seed/templates.sql`에 정적 데이터로 보관 (사용자별 데이터 아님). 가입 후 사용자가 "템플릿 불러오기" 시 RPC `clone_template(user_id, store_type)`이 사용자별 메뉴/레시피/재료를 자동 생성.

| store_type | 메뉴 수 | 재료 수 (근사) |
|---|---|---|
| bingsu_cafe | 8 | ~15 |
| cafe | 10 | ~10 |
| dessert_cafe | 6 (TBD, 1차 MVP는 bingsu/cafe만 우선) | TBD |

템플릿 데이터는 별도 정적 테이블 `public.menu_templates`(읽기 전용 RLS, 모든 사용자 SELECT 가능)에 저장.

---

## 횡단 인덱스 + 성능 고려

- 대시보드 "어제 매출" 쿼리: `(user_id, sold_at DESC)` 인덱스
- 캘린더 월간 뷰: `(user_id, sold_at)` BETWEEN 날짜 범위 — 동일 인덱스 활용
- 메뉴 마진 자동 재계산: `recipe_items` JOIN 시 `(menu_id)`, `(ingredient_id)` 양쪽 인덱스
- RLS 성능: 모든 RLS 정책이 `auth.uid() = user_id` 단일 형태라 Postgres가 인덱스 활용 효율적

---

## 단위 테스트 매핑 (헌법 v1.3.0 Testing 의무)

| 도메인 모듈 | 테스트 파일 | 검증 |
|---|---|---|
| `lib/domain/pricing.ts` | `tests/unit/pricing.test.ts` | 가중 이동 평균법 30일 시나리오, 첫 매입(재고 0) edge case, 부동소수점 누적 ≤0.01원 |
| `lib/domain/margin.ts` | `tests/unit/margin.test.ts` | 메뉴 원가/마진율 계산, 라벨 누락 시 fail (typed return) |
| `lib/domain/snapshot.ts` | `tests/unit/snapshot.test.ts` | Sale 저장·편집 시 스냅샷 보존, 7일 초과 lock |
| `lib/domain/forecast.ts` | `tests/unit/forecast.test.ts` | 영업일 그룹 + 개별요일 shrinkage 예측, 리드타임, 안전여유, 콜드스타트, ±20% 급증 감지 |
| `lib/domain/regular-days-off.ts` | `tests/unit/regular-days-off.test.ts` | 정기휴무 제외 (누락/푸시/예측), 변경 snapshot, 예외 영업 |

| 통합 시나리오 | 테스트 파일 | 검증 |
|---|---|---|
| RLS 격리 | `tests/integration/rls.test.ts` | 모든 도메인 테이블에 cross-user SELECT/UPDATE/DELETE 거부 |
| Sale 저장 | `tests/integration/sale-save.test.ts` | RPC 트랜잭션, 재고 차감, 스냅샷 저장 |
| Sale 편집 | `tests/integration/sale-edit.test.ts` | 7일 lock, 재고 되돌림+재차감, 이력 기록, 새 스냅샷 |
| 매입 흐름 | `tests/integration/purchase-flow.test.ts` | 가중 평균 갱신 → 메뉴 마진 자동 재계산 |

---

## 관련 spec entity 매핑

| spec Key Entity | data-model 섹션 |
|---|---|
| User (사장님) | §1 |
| Ingredient (재료) | §2 |
| IngredientPriceHistory (재료 단가 이력) | §3 |
| Vendor (거래처) | §4 |
| PurchaseOrder (매입) | §5 |
| Menu (메뉴) | §6 |
| RecipeItem (레시피 항목) | §6 |
| Sale (판매) | §7 |
| DailyStockCount (재고 실사) | §9 |
| SaleEditHistory (판매 편집 이력) | §8 |

추가 모델: PushSubscription (§10) — spec entity에는 없지만 FR-013/014/015 푸시 의무 충족에 필요.
