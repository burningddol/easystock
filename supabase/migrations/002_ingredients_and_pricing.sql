-- Migration: ingredients + ingredient_price_history + RLS
-- Spec: data-model.md §2-3, FR-002/004/029/038
-- 헌법 III: 가중 이동 평균법 단가 산정의 기반 테이블

-- ─── 단위 enum ──────────────────────────────────────────────────
create type public.ingredient_unit as enum ('g', 'ml', 'piece');

-- ─── 단가 변경 사유 enum ────────────────────────────────────────
create type public.price_history_reason as enum (
  'purchase',
  'stock_count_correction',
  'sale_consumption',
  'sale_edit_revert',
  'sale_edit_apply'
);

-- ─── ingredients ─────────────────────────────────────────────────
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  unit public.ingredient_unit not null,
  current_stock numeric(12, 3) not null default 0,
  current_avg_price numeric(12, 4) not null default 0,
  expiry_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ingredients_name_per_user_unique unique (user_id, name),
  constraint ingredients_stock_nonneg check (current_stock >= 0),
  constraint ingredients_avg_price_nonneg check (current_avg_price >= 0),
  constraint ingredients_name_length check (char_length(name) between 1 and 50)
);

comment on table public.ingredients is '재료. 이름은 사용자 단위 unique (FR-038). 단위는 등록 후 변경 불가 (data-model §2 Validation).';
comment on column public.ingredients.current_avg_price is '가중 이동 평균법으로 산정 (헌법 III). 매입 시에만 갱신, 실사는 수량만 보정.';

create index ingredients_user_active_idx on public.ingredients (user_id, is_active);

create trigger ingredients_set_updated_at
before update on public.ingredients
for each row
execute function public.set_updated_at();

-- 단위 변경 차단 트리거 (data-model §2 Validation)
create or replace function public.reject_unit_change()
returns trigger
language plpgsql
as $$
begin
  if new.unit is distinct from old.unit then
    raise exception 'ingredient unit cannot be changed (id=%, old=%, new=%)',
      old.id, old.unit, new.unit
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger ingredients_reject_unit_change
before update on public.ingredients
for each row
execute function public.reject_unit_change();

-- ─── ingredient_price_history (FR-029) ──────────────────────────
create table public.ingredient_price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  changed_at timestamptz not null default now(),
  previous_avg_price numeric(12, 4) not null,
  new_avg_price numeric(12, 4) not null,
  previous_stock numeric(12, 3) not null,
  new_stock numeric(12, 3) not null,
  reason public.price_history_reason not null,
  reference_id uuid
);

comment on table public.ingredient_price_history is '재료 평균 단가/재고 변경 이력. 매입·실사·판매·편집 모든 사건 기록 (FR-029).';
comment on column public.ingredient_price_history.reference_id is '매입/실사/판매 레코드 ID. FK 제약 없음 (이력 보존 우선).';

create index ingredient_price_history_ingredient_idx
on public.ingredient_price_history (ingredient_id, changed_at desc);

create index ingredient_price_history_user_changed_idx
on public.ingredient_price_history (user_id, changed_at desc);

-- ─── RLS 정책 (헌법 IV) ─────────────────────────────────────────
alter table public.ingredients enable row level security;
alter table public.ingredient_price_history enable row level security;

create policy ingredients_isolated
on public.ingredients
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy ingredient_price_history_isolated
on public.ingredient_price_history
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.ingredients to authenticated;
grant select on public.ingredient_price_history to authenticated;
-- ingredient_price_history INSERT는 RPC (save_purchase 등)에서만, 직접 INSERT 금지.
