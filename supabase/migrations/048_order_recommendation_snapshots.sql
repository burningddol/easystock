-- Migration: 발주 추천 스냅샷 저장
-- 추천 당시의 수량/재고/소진일을 저장해 추후 과잉/부족 발주 리포트의 기준 데이터로 사용.

create table if not exists public.order_recommendation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  source text not null default 'inventory_orders',
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.order_recommendation_snapshot_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.order_recommendation_snapshots(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  recommended_quantity numeric not null,
  current_stock numeric not null,
  expected_depletion_date date,
  order_by_date date,
  lead_time_days integer not null,
  safety_buffer_days integer not null,
  purchase_coverage_days integer not null,
  created_at timestamptz not null default now(),
  constraint order_recommendation_snapshot_items_quantity_check
    check (recommended_quantity > 0),
  constraint order_recommendation_snapshot_items_stock_check
    check (current_stock >= 0),
  constraint order_recommendation_snapshot_items_days_check
    check (lead_time_days >= 0 and safety_buffer_days >= 0 and purchase_coverage_days >= 1)
);

create index if not exists order_recommendation_snapshots_user_created_idx
  on public.order_recommendation_snapshots(user_id, created_at desc);

create index if not exists order_recommendation_snapshot_items_snapshot_idx
  on public.order_recommendation_snapshot_items(snapshot_id);

alter table public.order_recommendation_snapshots enable row level security;
alter table public.order_recommendation_snapshot_items enable row level security;

drop policy if exists order_recommendation_snapshots_owner_select on public.order_recommendation_snapshots;
create policy order_recommendation_snapshots_owner_select
on public.order_recommendation_snapshots
for select
using (user_id = auth.uid());

drop policy if exists order_recommendation_snapshot_items_owner_select on public.order_recommendation_snapshot_items;
create policy order_recommendation_snapshot_items_owner_select
on public.order_recommendation_snapshot_items
for select
using (user_id = auth.uid());

create or replace function public.save_order_recommendation_snapshot(
  p_vendor_id uuid,
  p_source text,
  p_items jsonb
)
returns table (
  snapshot_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_vendor_id is not null and not exists (
    select 1 from public.vendors v where v.id = p_vendor_id and v.user_id = v_user_id
  ) then
    raise exception 'vendor_not_found' using errcode = 'P0002';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order_recommendation_items' using errcode = '22023';
  end if;

  insert into public.order_recommendation_snapshots (user_id, vendor_id, source)
  values (v_user_id, p_vendor_id, coalesce(nullif(p_source, ''), 'inventory_orders'))
  returning id into v_snapshot_id;

  insert into public.order_recommendation_snapshot_items (
    snapshot_id,
    user_id,
    ingredient_id,
    recommended_quantity,
    current_stock,
    expected_depletion_date,
    order_by_date,
    lead_time_days,
    safety_buffer_days,
    purchase_coverage_days
  )
  select
    v_snapshot_id,
    v_user_id,
    (item ->> 'ingredient_id')::uuid,
    (item ->> 'recommended_quantity')::numeric,
    (item ->> 'current_stock')::numeric,
    nullif(item ->> 'expected_depletion_date', '')::date,
    nullif(item ->> 'order_by_date', '')::date,
    (item ->> 'lead_time_days')::integer,
    (item ->> 'safety_buffer_days')::integer,
    (item ->> 'purchase_coverage_days')::integer
  from jsonb_array_elements(p_items) as item
  join public.ingredients i
    on i.id = (item ->> 'ingredient_id')::uuid
   and i.user_id = v_user_id
   and i.is_active = true;

  if not exists (
    select 1
    from public.order_recommendation_snapshot_items si
    where si.snapshot_id = v_snapshot_id
  ) then
    raise exception 'no_valid_order_recommendation_items' using errcode = '22023';
  end if;

  return query select v_snapshot_id;
end;
$$;

create or replace function public.link_order_recommendation_snapshot_purchase(
  p_snapshot_id uuid,
  p_purchase_order_id uuid
)
returns table (
  snapshot_id uuid,
  purchase_order_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_snapshot_id is null then
    raise exception 'snapshot_id_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.purchase_orders po
    where po.id = p_purchase_order_id
      and po.user_id = v_user_id
  ) then
    raise exception 'purchase_order_not_found' using errcode = 'P0002';
  end if;

  update public.order_recommendation_snapshots s
  set purchase_order_id = p_purchase_order_id
  where s.id = p_snapshot_id
    and s.user_id = v_user_id;

  if not found then
    raise exception 'snapshot_not_found' using errcode = 'P0002';
  end if;

  return query select p_snapshot_id, p_purchase_order_id;
end;
$$;

revoke all on function public.save_order_recommendation_snapshot(uuid, text, jsonb) from public;
grant execute on function public.save_order_recommendation_snapshot(uuid, text, jsonb) to authenticated;

revoke all on function public.link_order_recommendation_snapshot_purchase(uuid, uuid) from public;
grant execute on function public.link_order_recommendation_snapshot_purchase(uuid, uuid) to authenticated;
