# Contract: Domain RPC Functions

**Source**: Supabase Postgres functions (`public.*`)
**Caller**: Next.js 클라이언트 (`supabase.rpc(...)`) + Edge Functions (service role)
**Auth**: 모든 RPC는 `auth.uid()` 기반 RLS 적용. service role 호출은 명시 표기.

모든 입력은 Zod로 클라이언트에서 1차 검증 + Postgres function에서 2차 검증.

---

## RPC 목록 (도메인별)

### 매입 (Purchase)

#### `save_purchase(payload)`

**Input** (Zod):
```ts
const SavePurchaseInput = z.object({
  vendorId: z.string().uuid(),
  purchasedAt: z.string().date(),         // YYYY-MM-DD
  items: z.array(z.object({
    ingredientId: z.string().uuid(),
    quantity: z.number().positive(),
    amount: z.number().nonnegative(),
  })).min(1),
});
```

**Output**:
```ts
type SavePurchaseResult = {
  purchaseOrderId: string;
  priceChangeAlerts: Array<{
    ingredientId: string;
    ingredientName: string;
    previousAvgPrice: number;
    newAvgPrice: number;
    changePercent: number;  // 양수 = 인상, 음수 = 인하
  }>;  // ±5% 이상 변동만 포함 (FR-005)
};
```

**Behavior** (트랜잭션):
1. 입력 검증 (벤더·재료가 본인 소유인지, 활성인지)
2. PurchaseOrder + items 저장 (총액 = Σ items.amount)
3. 각 ingredient에 가중 이동 평균법 적용:
   ```
   new_avg = (current_stock × current_avg + item.quantity × (item.amount / item.quantity))
             / (current_stock + item.quantity)
   ```
   - 첫 매입(`current_stock = 0`)이면 new_avg = item.amount / item.quantity (FR-004)
3. `current_stock += quantity`
4. `IngredientPriceHistory` 추가 (reason='purchase')
5. ±5% 변동 항목을 `priceChangeAlerts`로 응답

---

### 판매 (Sale)

#### `save_sale(payload)`

**Input**:
```ts
const SaveSaleInput = z.object({
  soldAt: z.string().date(),
  items: z.array(z.object({
    menuId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});
```

**Output**:
```ts
type SaveSaleResult = {
  saleId: string;
  totalRevenue: number;
  totalCostSnapshot: number;
  totalNetProfit: number;        // = revenue - cost (재료 원가 기준)
  marginPercent: number;
  marginLabel: '재료 원가 기준 (이동평균법)';  // 항상 고정 — FR-019
};
```

**Behavior** (트랜잭션):
1. 메뉴가 활성 + 본인 소유인지 검증
2. 각 메뉴별로 메뉴 원가 계산 (현재 평균 단가 기준)
3. Sale + SaleItem 저장 (각 항목에 `menu_cost_snapshot`, `unit_price` 보존)
4. 재료 자동 차감: `current_stock -= Σ recipe × item.quantity`
5. `IngredientPriceHistory` 추가 (reason='sale_consumption', new_avg_price = previous_avg_price)
6. 재고 음수 시 0으로 보정 + 응답에 경고

**Errors**:
- `menu_inactive`: 비활성 메뉴 포함
- `menu_no_recipe`: 레시피 미등록 메뉴 (Edge case 차단, FR-006 전제)
- `future_date`: soldAt > today (Edge case 차단)
- `out_of_window`: soldAt < today - 7일 (FR-011)
- `duplicate_sale`: 같은 sold_at에 이미 Sale 존재 (사용자가 정정하려면 edit_sale 사용)

---

#### `edit_sale(payload)`

**Input**:
```ts
const EditSaleInput = z.object({
  saleId: z.string().uuid(),
  reason: z.string().max(200).optional(),
  newItems: z.array(z.object({
    menuId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});
```

**Output**: `SaveSaleResult` 형식 (`saleId`는 기존 ID 유지)

**Behavior** (트랜잭션):
1. Sale `is_locked` 체크 → true면 `sale_locked` 에러 (FR-030, 7일 초과)
2. SaleEditHistory에 변경 전 항목 + 사유 기록 (FR-031)
3. 기존 항목들 재고 되돌림 + `IngredientPriceHistory` reason='sale_edit_revert'
4. 새 항목 메뉴 원가 재계산 → 새 스냅샷 (FR-032)
5. SaleItem 전체 교체 + 재고 재차감 + reason='sale_edit_apply'
6. 재고 음수 시 reject (FR-033 edge case "Sale 편집으로 음수")

**Errors**:
- `sale_locked`: 7일 초과
- `negative_stock`: 새 항목 차감 시 음수 발생
- 기타 save_sale과 동일

---

#### `delete_sale(saleId)`

**Behavior**:
1. `is_locked` 체크
2. SaleEditHistory에 `change_type='delete'` + before_items 기록
3. 재고 되돌림
4. Sale + items 삭제

---

### 메뉴 (Menu)

#### `clone_menu_template(storeType)`

**Input**: `storeType: 'bingsu_cafe' | 'cafe' | 'dessert_cafe'`

**Output**:
```ts
type CloneTemplateResult = {
  menuIds: string[];
  ingredientIds: string[];
  vendorIds: string[];   // 빈 배열 가능 (1차 MVP는 vendor 템플릿 미제공)
};
```

**Behavior**:
1. `menu_templates` 정적 테이블에서 storeType의 템플릿 조회
2. 사용자별 Ingredient 자동 생성 (이름 unique 충돌 시 skip + 안내)
3. 사용자별 Menu + RecipeItem 자동 생성
4. 마진율은 자동 계산 가능 (재료 단가 0 → 마진 100%로 표시되므로 안내)

---

#### `recompute_menu_costs()`

**Behavior** (선택적, 트리거 또는 명시 호출):
- 재료 평균 단가 변경 시 메뉴 마진을 캐시 테이블에 업데이트할 경우 사용
- 1차 MVP는 캐시 없이 매 조회 시 클라이언트 계산 → 이 RPC는 Phase 1+에서 필요시 추가

---

### 재고 실사 (Stock Count)

#### `apply_stock_count(payload)`

**Input**:
```ts
const ApplyStockCountInput = z.object({
  countedAt: z.string().date(),
  items: z.array(z.object({
    ingredientId: z.string().uuid(),
    actualStock: z.number().nonnegative(),
  })).min(1),
});
```

**Output**:
```ts
type ApplyStockCountResult = {
  stockCountId: string;
  weeklyLossAmount: number;  // = Σ (system - actual) × current_avg_price
  itemDifferences: Array<{
    ingredientId: string;
    name: string;
    systemStock: number;
    actualStock: number;
    diff: number;
    lossAmount: number;
  }>;
};
```

**Behavior**:
1. 각 ingredient `current_stock = actualStock` (수량만, FR-016)
2. `weekly_loss_amount` 계산 (FR-017)
3. `IngredientPriceHistory` 추가 (reason='stock_count_correction', new_avg_price = previous_avg_price — 단가 불변, FR-016)

---

### 소진 예측 (Forecast)

#### `get_depletion_forecast()`

**Output**:
```ts
type DepletionForecast = Array<{
  ingredientId: string;
  name: string;
  unit: 'g'|'ml'|'piece';
  currentStock: number;
  currentAvgPrice: number;
  signedUpAt: string;
  regularDaysOff: Weekday[];
  safetyBufferDays: number;
  forecastSensitivity: 'stable' | 'balanced' | 'responsive';
  leadTimeDays: number;
  leadTimeVendorId: string | null;
  leadTimeVendorName: string | null;
  isDefaultLeadTime: boolean;
  consumptionSamples: Array<{ date: string; amount: number }>;
}>;
```

**Behavior**:
1. RPC는 예측 raw data만 반환한다. 최종 소진일, status, trend, 콜드스타트, 신뢰도는 `src/lib/domain/forecast.ts`에서 계산한다
2. 가입 후 7일 이내 → 클라이언트 도메인 함수가 `isColdStart=true`로 처리하고 소진일을 표시하지 않는다 (FR-018)
3. 그 외 정상 영업일 데이터로 계층형 최근가중 평균 계산 (FR-012, 정기휴무 제외 FR-042)
   - 영업일 그룹 anchor: 평일(월~목), 금요일, 주말(토~일)
   - 개별요일 보정: `count / (count + prior)` shrinkage로 그룹 평균과 혼합
   - 개별요일 최대 반영 비중: 85%
4. 최근 sample일수록 지수감쇠 가중치를 적용하고, 극단값은 중앙값 기반 cap으로 완화한다
5. 거래처 리드타임 + 사용자가 설정한 안전여유일을 반영한다
6. status 분류는 `소진일까지 남은 일수 - 리드타임 - 안전여유일` buffer 기준이다:
   - `critical`: buffer ≤ 1
   - `order_needed`: buffer = 2
   - `caution`: buffer 3~4
   - `safe`: buffer ≥ 5 또는 1년 내 소진 없음
7. trend는 7일 평균 vs 30일 평균 ±20% 기준으로 계산하고, 실제 예측 보정 계수는 0.85~1.25로 제한한다 (FR-025)
8. 메뉴 기반 재료 예측이 가능한 경우, 메뉴 수요 예측 + 기본 레시피 + 옵션 선택률로 계산한 재료 소요량을 재료 카드의 우선 예측 근거로 사용한다
9. 메뉴 기반 재료 수요는 최근 14일 백테스트의 `actualTotal / predictedTotal`로 재료별 보정계수를 계산해 미래 일별 수요에 적용한다
   - 비교 가능한 실제 소비일이 7일 미만이면 보정하지 않는다
   - 5% 이내 차이는 노이즈로 보고 보정하지 않는다
   - 보정계수는 0.85~1.30으로 제한한다
   - 보정계수는 RPC나 DB에 저장하지 않고 클라이언트 application layer에서 현재 조회 시점마다 계산한다

---

### 정기휴무 (Settings)

#### `update_regular_days_off(payload)`

**Input**:
```ts
const UpdateRegularDaysOffInput = z.object({
  daysOff: z.array(z.enum(['MON','TUE','WED','THU','FRI','SAT','SUN'])),  // 빈 배열 가능
});
```

**Behavior**:
- `users.regular_days_off` 갱신 (FR-040)
- 변경일 이후부터 적용 (FR-044), 과거 데이터 영향 없음

---

### 캘린더 (Calendar)

#### `get_calendar_month(year, month)`

**Output**:
```ts
type CalendarMonth = {
  year: number;
  month: number;
  cumulative: {
    totalRevenue: number;
    totalNetProfit: number;
    avgDailyRevenue: number;
    operatingDays: number;
  };
  cells: Array<{
    date: string;          // YYYY-MM-DD
    isFuture: boolean;
    isBeforeSignup: boolean;
    isRegularDayOff: boolean;
    hasSale: boolean;
    hasPurchase: boolean;
    isMissing: boolean;    // 영업일인데 sale 없음 (정기휴무 제외)
    consecutiveMissingDays: number;  // 연속 누락 (2일+ 강조)
    revenue: number | null;       // 만 단위 표시는 클라이언트
    netProfit: number | null;
  }>;
  marginLabel: '재료 원가 기준 (이동평균법)';
};
```

**Behavior**:
- 월별 30일 셀 데이터 일괄 생성 (FR-021~024)
- 정기휴무 요일은 `isRegularDayOff=true` + `isMissing=false` (FR-043)
- 단, 정기휴무 요일에 Sale 있으면 `isRegularDayOff=false, hasSale=true` (예외 영업, FR-045)

---

### 푸시 (Push)

#### `subscribe_push(payload)`

**Input**:
```ts
{
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}
```

**Behavior**: PushSubscription 레코드 저장 (upsert by endpoint)

#### `unsubscribe_push(endpoint)`

**Behavior**: 레코드 삭제

---

### 사용자 행동 (Analytics)

#### `record_consent(payload)`

**Input**: `{ consent: boolean }`

**Behavior**: `users.analytics_consent` 갱신. GA4 클라이언트 측 활성/비활성 게이트 (R7)

---

## Error Conventions

모든 RPC 응답은 다음 형식 중 하나:
```ts
type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; field?: string } }
```

표준 에러 코드:
| 코드 | 의미 |
|---|---|
| `not_authenticated` | 세션 없음 (RLS 차단) |
| `not_authorized` | 다른 사용자 데이터 접근 시도 |
| `validation_failed` | 입력 검증 실패 |
| `entity_not_found` | 참조 ID 없음 |
| `entity_inactive` | 비활성 항목 사용 시도 |
| `unique_violation` | 이름 중복 (FR-038) |
| `sale_locked` | 7일 초과 편집 시도 |
| `out_of_window` | 7일 초과 소급 입력 |
| `negative_stock` | 재고 음수 발생 |

---

## Test Coverage (헌법 v1.3.0)

| RPC | 단위/통합 테스트 |
|---|---|
| `save_purchase` | `tests/integration/purchase-flow.test.ts`: 가중 평균 적용 + 메뉴 마진 자동 재계산 |
| `save_sale` | `tests/integration/sale-save.test.ts`: 트랜잭션, 스냅샷, 재고 차감, 7일 초과 reject |
| `edit_sale` | `tests/integration/sale-edit.test.ts`: lock, 되돌림+재차감, 이력 |
| `apply_stock_count` | 통합: 단가 불변 + 손실액 |
| `get_depletion_forecast` | `tests/unit/forecast.test.ts`: 합성 시나리오 (정상/급증/콜드스타트/정기휴무 제외) |
| RLS | `tests/integration/rls.test.ts`: 모든 RPC가 cross-user 접근 거부 |
