-- Migration: apply sale snapshot rewrite RPC
--
-- Recomputes sale item cost snapshots and sale total cost snapshots from the
-- inventory event stream, using the latest ingredient average cost before each
-- sale's created_at.

create table public.sale_snapshot_replay_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  from_date date not null,
  applied_at timestamptz not null default now(),
  affected_sale_count integer not null default 0,
  affected_item_count integer not null default 0,
  total_cost_delta numeric(14, 4) not null default 0,
  note text,

  constraint sale_snapshot_replay_runs_sale_count_nonneg check (affected_sale_count >= 0),
  constraint sale_snapshot_replay_runs_item_count_nonneg check (affected_item_count >= 0)
);

comment on table public.sale_snapshot_replay_runs is
  'Audit header for sale snapshot rewrite runs.';

create table public.sale_snapshot_replay_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.sale_snapshot_replay_runs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  sale_item_id uuid not null references public.sale_items (id) on delete cascade,
  menu_id uuid not null references public.menus (id) on delete restrict,
  quantity integer not null,
  previous_menu_cost_snapshot numeric(14, 4) not null,
  applied_menu_cost_snapshot numeric(14, 4) not null,
  previous_total_cost_snapshot numeric(14, 4) not null,
  applied_total_cost_snapshot numeric(14, 4) not null,
  cost_delta numeric(14, 4) not null,

  constraint sale_snapshot_replay_run_items_quantity_positive check (quantity > 0)
);

comment on table public.sale_snapshot_replay_run_items is
  'Per-sale-item audit rows for a sale snapshot rewrite run.';

create index sale_snapshot_replay_runs_user_applied_idx
on public.sale_snapshot_replay_runs (user_id, applied_at desc);

create index sale_snapshot_replay_run_items_run_idx
on public.sale_snapshot_replay_run_items (run_id);

alter table public.sale_snapshot_replay_runs enable row level security;
alter table public.sale_snapshot_replay_run_items enable row level security;

create policy sale_snapshot_replay_runs_isolated
on public.sale_snapshot_replay_runs
for select
using (auth.uid() = user_id);

create policy sale_snapshot_replay_run_items_isolated
on public.sale_snapshot_replay_run_items
for select
using (auth.uid() = user_id);

grant select on public.sale_snapshot_replay_runs to authenticated;
grant select on public.sale_snapshot_replay_run_items to authenticated;

create or replace function public.apply_sale_snapshot_rewrite(
  p_from_date date,
  p_note text default null
)
returns table (
  replay_run_id uuid,
  affected_sale_count integer,
  affected_item_count integer,
  total_cost_delta numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_run_id uuid;
  v_sale_count integer := 0;
  v_item_count integer := 0;
  v_total_cost_delta numeric(14, 4) := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_from_date is null then
    raise exception 'invalid_input: from_date is required' using errcode = '22023';
  end if;

  create temporary table if not exists sale_snapshot_replay_rows (
    sale_id uuid not null,
    sale_item_id uuid not null,
    menu_id uuid not null,
    quantity integer not null,
    previous_menu_cost_snapshot numeric(14, 4) not null,
    applied_menu_cost_snapshot numeric(14, 4) not null,
    previous_total_cost_snapshot numeric(14, 4) not null,
    applied_total_cost_snapshot numeric(14, 4) not null,
    cost_delta numeric(14, 4) not null
  ) on commit drop;

  truncate table sale_snapshot_replay_rows;

  insert into sale_snapshot_replay_rows (
    sale_id,
    sale_item_id,
    menu_id,
    quantity,
    previous_menu_cost_snapshot,
    applied_menu_cost_snapshot,
    previous_total_cost_snapshot,
    applied_total_cost_snapshot,
    cost_delta
  )
  select
    s.id as sale_id,
    si.id as sale_item_id,
    si.menu_id,
    si.quantity,
    si.menu_cost_snapshot as previous_menu_cost_snapshot,
    coalesce(sum(ri.quantity_per_serving * coalesce(last_event.avg_price_after, 0)), 0)::numeric(14, 4) as applied_menu_cost_snapshot,
    s.total_cost_snapshot as previous_total_cost_snapshot,
    0::numeric(14, 4) as applied_total_cost_snapshot,
    0::numeric(14, 4) as cost_delta
  from public.sales s
  join public.sale_items si on si.sale_id = s.id
  join public.recipe_items ri on ri.menu_id = si.menu_id
  left join lateral (
    select ie.avg_price_after
    from public.inventory_events ie
    where ie.user_id = s.user_id
      and ie.ingredient_id = ri.ingredient_id
      and ie.occurred_at < s.created_at
    order by ie.occurred_at desc, ie.event_seq desc
    limit 1
  ) last_event on true
  where s.user_id = v_user_id
    and s.sold_at >= p_from_date
  group by s.id, si.id;

  update sale_snapshot_replay_rows as row
  set applied_total_cost_snapshot = totals.applied_total_cost_snapshot,
      cost_delta = (row.applied_menu_cost_snapshot - row.previous_menu_cost_snapshot) * row.quantity
  from (
    select
      sale_id,
      sum(applied_menu_cost_snapshot * quantity)::numeric(14, 4) as applied_total_cost_snapshot
    from sale_snapshot_replay_rows
    group by sale_id
  ) totals
  where totals.sale_id = row.sale_id;

  insert into public.sale_snapshot_replay_runs (
    user_id,
    from_date,
    note,
    affected_sale_count,
    affected_item_count,
    total_cost_delta
  )
  select
    v_user_id,
    p_from_date,
    nullif(btrim(p_note), ''),
    count(distinct sale_id)::integer,
    count(*)::integer,
    coalesce(sum(cost_delta), 0)::numeric(14, 4)
  from sale_snapshot_replay_rows
  returning id into v_run_id;

  update public.sale_items si
  set menu_cost_snapshot = row.applied_menu_cost_snapshot
  from sale_snapshot_replay_rows row
  where si.id = row.sale_item_id;

  update public.sales s
  set total_cost_snapshot = totals.applied_total_cost_snapshot,
      updated_at = now()
  from (
    select
      sale_id,
      max(applied_total_cost_snapshot) as applied_total_cost_snapshot
    from sale_snapshot_replay_rows
    group by sale_id
  ) totals
  where s.id = totals.sale_id;

  insert into public.sale_snapshot_replay_run_items (
    run_id,
    user_id,
    sale_id,
    sale_item_id,
    menu_id,
    quantity,
    previous_menu_cost_snapshot,
    applied_menu_cost_snapshot,
    previous_total_cost_snapshot,
    applied_total_cost_snapshot,
    cost_delta
  )
  select
    v_run_id,
    v_user_id,
    row.sale_id,
    row.sale_item_id,
    row.menu_id,
    row.quantity,
    row.previous_menu_cost_snapshot,
    row.applied_menu_cost_snapshot,
    row.previous_total_cost_snapshot,
    row.applied_total_cost_snapshot,
    row.cost_delta
  from sale_snapshot_replay_rows row;

  select count(distinct sale_id), count(*), coalesce(sum(cost_delta), 0)
  into v_sale_count, v_item_count, v_total_cost_delta
  from sale_snapshot_replay_rows;

  update public.sale_snapshot_replay_runs
  set affected_sale_count = v_sale_count,
      affected_item_count = v_item_count,
      total_cost_delta = v_total_cost_delta
  where id = v_run_id;

  return query select
    v_run_id,
    v_sale_count,
    v_item_count,
    v_total_cost_delta;
end;
$$;

comment on function public.apply_sale_snapshot_rewrite(date, text) is
  'Rewrites sale item cost snapshots and sale total cost snapshots from inventory replay history.';

revoke all on function public.apply_sale_snapshot_rewrite(date, text) from public;
grant execute on function public.apply_sale_snapshot_rewrite(date, text) to authenticated;
