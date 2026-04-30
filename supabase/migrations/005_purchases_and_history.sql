-- Migration: vendors + purchase_orders + purchase_order_items + RLS
-- Spec: data-model.md §4-5, FR-004/005/029
-- 헌법 IV: user_id 격리. 헌법 III: 가중 이동 평균법은 save_purchase RPC가 트랜잭션으로

-- ─── vendors ────────────────────────────────────────────────────
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  lead_time_days integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vendors_name_per_user_unique unique (user_id, name),
  constraint vendors_lead_time_nonneg check (lead_time_days >= 0),
  constraint vendors_name_length check (char_length(name) between 1 and 50)
);

comment on table public.vendors is
  '거래처. 이름은 사용자 단위 unique (FR-038). 리드타임 미설정 시 기본 1일.';

create index vendors_user_active_idx on public.vendors (user_id, is_active);

create trigger vendors_set_updated_at
before update on public.vendors
for each row
execute function public.set_updated_at();

-- ─── purchase_orders ────────────────────────────────────────────
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  purchased_at date not null,
  total_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),

  constraint purchase_orders_total_nonneg check (total_amount >= 0)
);

comment on table public.purchase_orders is
  '매입 헤더. total_amount는 save_purchase RPC가 items 합산해 채움.';

create index purchase_orders_user_purchased_idx
on public.purchase_orders (user_id, purchased_at desc);

create index purchase_orders_vendor_idx on public.purchase_orders (vendor_id);

-- ─── purchase_order_items ───────────────────────────────────────
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  quantity numeric(12, 3) not null,
  amount numeric(14, 2) not null,
  -- unit_price = amount / quantity. quantity > 0 CHECK이 0 나눗셈 차단.
  unit_price numeric(12, 4) generated always as (amount / quantity) stored,

  constraint purchase_order_items_quantity_positive check (quantity > 0),
  constraint purchase_order_items_amount_nonneg check (amount >= 0)
);

comment on table public.purchase_order_items is
  '매입 명세. unit_price는 amount/quantity로 자동 계산 (data-model §5).';

create index purchase_order_items_order_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_ingredient_idx on public.purchase_order_items (ingredient_id);

-- ─── RLS (헌법 IV) ──────────────────────────────────────────────
alter table public.vendors enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy vendors_isolated
on public.vendors
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy purchase_orders_isolated
on public.purchase_orders
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy purchase_order_items_isolated
on public.purchase_order_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.vendors to authenticated;
grant select on public.purchase_orders to authenticated;
grant select on public.purchase_order_items to authenticated;
-- INSERT/UPDATE는 save_purchase RPC만 (트랜잭션 보장).
