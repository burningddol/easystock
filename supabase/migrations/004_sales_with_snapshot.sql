-- Migration: sales + sale_items + RLS + 7일 lock generated column
-- Spec: data-model.md §7, FR-006~011, FR-019, FR-030
-- 헌법 III: 메뉴 원가/판매가 스냅샷 영구 보존 (sale_items.menu_cost_snapshot, unit_price)
-- 헌법 IV: user_id 격리 RLS

-- ─── sales ──────────────────────────────────────────────────────
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  sold_at date not null,
  total_revenue numeric(14, 2) not null default 0,
  total_cost_snapshot numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sales_revenue_nonneg check (total_revenue >= 0),
  constraint sales_cost_nonneg check (total_cost_snapshot >= 0),
  constraint sales_one_per_day_per_user unique (user_id, sold_at)
);

comment on table public.sales is
  '일자별 판매 헤더. (user_id, sold_at) unique — 같은 날 두 번 저장은 edit_sale로 (FR-006).';
comment on column public.sales.total_cost_snapshot is
  '저장 시점 메뉴 원가 합 (Σ sale_items.menu_cost_snapshot × quantity). 헌법 III: 영구 불변.';
comment on column public.sales.created_at is
  'FR-030 7일 lock 기준. now() - created_at > 7일이면 edit_sale / delete_sale RPC가 거부.';

create index sales_user_sold_at_idx on public.sales (user_id, sold_at desc);

create trigger sales_set_updated_at
before update on public.sales
for each row
execute function public.set_updated_at();

-- ─── sale_items ─────────────────────────────────────────────────
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  menu_id uuid not null references public.menus (id) on delete restrict,
  quantity integer not null,
  unit_price numeric(10, 2) not null,
  menu_cost_snapshot numeric(14, 4) not null,

  constraint sale_items_quantity_positive check (quantity > 0),
  constraint sale_items_unit_price_nonneg check (unit_price >= 0),
  constraint sale_items_cost_nonneg check (menu_cost_snapshot >= 0),
  constraint sale_items_unique_menu_per_sale unique (sale_id, menu_id)
);

comment on table public.sale_items is
  '판매 명세. (sale_id, menu_id) unique — 한 판매에 같은 메뉴 중복 행 금지 (data-model §7).';
comment on column public.sale_items.unit_price is
  '판매 시점 메뉴 가격 스냅샷 — 메뉴 가격이 나중에 바뀌어도 과거 매출 불변.';
comment on column public.sale_items.menu_cost_snapshot is
  '판매 시점 메뉴 1개당 원가 (Σ recipe.quantity × ingredient.current_avg_price). 헌법 III.';

create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_menu_idx on public.sale_items (menu_id);

-- ─── RLS (헌법 IV) ──────────────────────────────────────────────
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy sales_isolated
on public.sales
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy sale_items_isolated
on public.sale_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 직접 INSERT/UPDATE/DELETE 차단 — RPC만 허용. 단 SELECT는 허용 (캘린더/오늘 화면).
grant select on public.sales to authenticated;
grant select on public.sale_items to authenticated;
