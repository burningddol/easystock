-- Migration: daily_stock_counts + stock_count_items + RLS
-- Spec: data-model.md §9, FR-015~017, FR-028
-- 헌법 III: 실사는 수량만 보정, current_avg_price는 절대 안 바꿈 (FR-016)

create table public.daily_stock_counts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  counted_at date not null,
  created_at timestamptz not null default now(),

  constraint stock_counts_one_per_day_per_user unique (user_id, counted_at)
);

comment on table public.daily_stock_counts is
  '재고 실사 헤더. (user_id, counted_at) unique — 같은 날 두 번 실사는 edit으로 (1차 MVP는 unique).';

create index daily_stock_counts_user_counted_idx
on public.daily_stock_counts (user_id, counted_at desc);

-- ─── stock_count_items ──────────────────────────────────────────
create table public.stock_count_items (
  id uuid primary key default gen_random_uuid(),
  stock_count_id uuid not null references public.daily_stock_counts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  actual_stock numeric(12, 3) not null,
  system_stock_at_count numeric(12, 3) not null,
  weekly_loss_amount numeric(14, 4) not null,

  constraint stock_count_items_actual_nonneg check (actual_stock >= 0),
  constraint stock_count_items_system_nonneg check (system_stock_at_count >= 0),
  constraint stock_count_items_unique_ingredient_per_count unique (stock_count_id, ingredient_id)
);

comment on table public.stock_count_items is
  '재고 실사 명세. weekly_loss_amount = (system - actual) × current_avg_price 시점 스냅샷.';
comment on column public.stock_count_items.weekly_loss_amount is
  '실사 시점 손실액. system - actual 양수면 손실, 음수면 발견(over). 단가는 실사 시점 current_avg_price.';

create index stock_count_items_count_idx on public.stock_count_items (stock_count_id);
create index stock_count_items_ingredient_idx on public.stock_count_items (ingredient_id);

-- ─── RLS (헌법 IV) ──────────────────────────────────────────────
alter table public.daily_stock_counts enable row level security;
alter table public.stock_count_items enable row level security;

create policy daily_stock_counts_isolated
on public.daily_stock_counts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy stock_count_items_isolated
on public.stock_count_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select on public.daily_stock_counts to authenticated;
grant select on public.stock_count_items to authenticated;
-- INSERT는 apply_stock_count RPC만 (트랜잭션 보장).
