-- Migration: apply inventory replay RPC
--
-- Applies the read-only replay result to ingredients.current_stock/current_avg_price
-- and records an audit trail. Historical sale snapshots are intentionally not
-- rewritten in this step.

create table public.inventory_replay_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  from_date date not null,
  applied_at timestamptz not null default now(),
  affected_ingredient_count integer not null default 0,
  note text,

  constraint inventory_replay_runs_affected_nonneg check (affected_ingredient_count >= 0)
);

comment on table public.inventory_replay_runs is
  'Audit header for applied inventory replay runs.';
comment on column public.inventory_replay_runs.from_date is
  'Business date from which inventory_events were replayed.';

create table public.inventory_replay_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.inventory_replay_runs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  previous_stock numeric(12, 3) not null,
  applied_stock numeric(12, 3) not null,
  stock_delta numeric(12, 3) not null,
  previous_avg_price numeric(12, 4) not null,
  applied_avg_price numeric(12, 4) not null,
  avg_price_delta numeric(12, 4) not null,
  event_count integer not null,
  first_event_date date not null,
  last_event_date date not null,

  constraint inventory_replay_run_items_event_count_positive check (event_count > 0),
  constraint inventory_replay_run_items_unique_ingredient unique (run_id, ingredient_id)
);

comment on table public.inventory_replay_run_items is
  'Per-ingredient before/after audit rows for an applied inventory replay run.';

create index inventory_replay_runs_user_applied_idx
on public.inventory_replay_runs (user_id, applied_at desc);

create index inventory_replay_run_items_run_idx
on public.inventory_replay_run_items (run_id);

alter table public.inventory_replay_runs enable row level security;
alter table public.inventory_replay_run_items enable row level security;

create policy inventory_replay_runs_isolated
on public.inventory_replay_runs
for select
using (auth.uid() = user_id);

create policy inventory_replay_run_items_isolated
on public.inventory_replay_run_items
for select
using (auth.uid() = user_id);

grant select on public.inventory_replay_runs to authenticated;
grant select on public.inventory_replay_run_items to authenticated;

create or replace function public.apply_inventory_replay(
  p_from_date date,
  p_note text default null
)
returns table (
  replay_run_id uuid,
  affected_ingredient_count integer,
  stock_delta_total numeric,
  avg_price_delta_total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_run_id uuid;
  v_preview record;
  v_affected_count integer := 0;
  v_stock_delta_total numeric(14, 3) := 0;
  v_avg_price_delta_total numeric(14, 4) := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_from_date is null then
    raise exception 'invalid_input: from_date is required' using errcode = '22023';
  end if;

  insert into public.inventory_replay_runs (user_id, from_date, note)
  values (v_user_id, p_from_date, nullif(btrim(p_note), ''))
  returning id into v_run_id;

  for v_preview in
    select *
    from public.preview_inventory_replay(p_from_date)
    where stock_delta <> 0
       or avg_price_delta <> 0
    order by ingredient_name
  loop
    insert into public.inventory_replay_run_items (
      run_id,
      user_id,
      ingredient_id,
      previous_stock,
      applied_stock,
      stock_delta,
      previous_avg_price,
      applied_avg_price,
      avg_price_delta,
      event_count,
      first_event_date,
      last_event_date
    ) values (
      v_run_id,
      v_user_id,
      v_preview.ingredient_id,
      v_preview.current_stock,
      v_preview.replayed_stock,
      v_preview.stock_delta,
      v_preview.current_avg_price,
      v_preview.replayed_avg_price,
      v_preview.avg_price_delta,
      v_preview.event_count,
      v_preview.first_event_date,
      v_preview.last_event_date
    );

    update public.ingredients
    set current_stock = v_preview.replayed_stock,
        current_avg_price = v_preview.replayed_avg_price,
        updated_at = now()
    where id = v_preview.ingredient_id
      and user_id = v_user_id;

    v_affected_count := v_affected_count + 1;
    v_stock_delta_total := v_stock_delta_total + v_preview.stock_delta;
    v_avg_price_delta_total := v_avg_price_delta_total + v_preview.avg_price_delta;
  end loop;

  update public.inventory_replay_runs
  set affected_ingredient_count = v_affected_count
  where id = v_run_id;

  return query select
    v_run_id,
    v_affected_count,
    v_stock_delta_total,
    v_avg_price_delta_total;
end;
$$;

comment on function public.apply_inventory_replay(date, text) is
  'Applies inventory replay preview to ingredients current stock/average cost and writes audit rows. Does not rewrite sale snapshots.';

revoke all on function public.apply_inventory_replay(date, text) from public;
grant execute on function public.apply_inventory_replay(date, text) to authenticated;
