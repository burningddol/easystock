-- Migration: sale_edit_history — 판매 편집/삭제 이력 (FR-031, FR-032)
-- Spec: data-model.md §8

create type public.sale_change_type as enum ('edit', 'delete');

create table public.sale_edit_history (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  change_type public.sale_change_type not null,
  reason text,
  before_items jsonb not null,
  after_items jsonb,
  changed_at timestamptz not null default now(),

  constraint sale_edit_history_before_array check (jsonb_typeof(before_items) = 'array'),
  constraint sale_edit_history_after_array check (
    after_items is null or jsonb_typeof(after_items) = 'array'
  ),
  constraint sale_edit_history_reason_length check (
    reason is null or char_length(reason) <= 200
  )
);

comment on table public.sale_edit_history is
  '판매 편집/삭제 이력 (FR-031). before_items / after_items는 sale_items의 JSONB 스냅샷.';
comment on column public.sale_edit_history.before_items is
  '변경 전 sale_items 배열: [{"menu_id", "menu_name", "quantity", "unit_price", "menu_cost_snapshot"}, ...]';
comment on column public.sale_edit_history.after_items is
  '변경 후 동일 형식. delete의 경우 NULL.';

create index sale_edit_history_sale_idx on public.sale_edit_history (sale_id, changed_at desc);

alter table public.sale_edit_history enable row level security;

create policy sale_edit_history_isolated
on public.sale_edit_history
for select
using (auth.uid() = user_id);

-- INSERT는 RPC(security definer)만. 직접 쓰기 차단.
grant select on public.sale_edit_history to authenticated;
