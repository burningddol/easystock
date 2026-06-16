-- Migration: fix sale snapshot replay fallback
--
-- When a sale has no prior inventory event for an ingredient, replay should
-- fall back to the ingredient's current average price instead of zero.

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
    (
      (
        coalesce(base_cost.base_cost, 0) * si.quantity
        + coalesce(option_cost.option_cost_total, 0)
      ) / si.quantity
    )::numeric(14, 4) as applied_menu_cost_snapshot,
    s.total_cost_snapshot as previous_total_cost_snapshot,
    0::numeric(14, 4) as applied_total_cost_snapshot,
    0::numeric(14, 4) as cost_delta
  from public.sales s
  join public.sale_items si on si.sale_id = s.id
  left join lateral (
    select coalesce(sum(ri.quantity_per_serving * coalesce(last_event.avg_price_after, i.current_avg_price, 0)), 0)::numeric(14, 4) as base_cost
    from public.recipe_items ri
    join public.ingredients i on i.id = ri.ingredient_id
    left join lateral (
      select ie.avg_price_after
      from public.inventory_events ie
      where ie.user_id = s.user_id
        and ie.ingredient_id = ri.ingredient_id
        and ie.occurred_at < s.created_at
      order by ie.occurred_at desc, ie.event_seq desc
      limit 1
    ) last_event on true
    where ri.menu_id = si.menu_id
  ) base_cost on true
  left join lateral (
    select coalesce(sum(
      ((recipe_item ->> 'quantity_per_selection')::numeric)
      * sio.quantity
      * coalesce(last_event.avg_price_after, i.current_avg_price, 0)
    ), 0)::numeric(14, 4) as option_cost_total
    from public.sale_item_options sio
    cross join lateral jsonb_array_elements(sio.recipe_items_snapshot) as recipe_item
    join public.ingredients i on i.id = (recipe_item ->> 'ingredient_id')::uuid
    left join lateral (
      select ie.avg_price_after
      from public.inventory_events ie
      where ie.user_id = s.user_id
        and ie.ingredient_id = (recipe_item ->> 'ingredient_id')::uuid
        and ie.occurred_at < s.created_at
      order by ie.occurred_at desc, ie.event_seq desc
      limit 1
    ) last_event on true
    where sio.sale_item_id = si.id
  ) option_cost on true
  where s.user_id = v_user_id
    and s.sold_at >= p_from_date;

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

  update public.sale_item_options sio
  set option_cost_snapshot = coalesce((
    select coalesce(sum(
      ((recipe_item ->> 'quantity_per_selection')::numeric)
      * coalesce(last_event.avg_price_after, i.current_avg_price, 0)
    ), 0)::numeric(14, 4) as option_cost_snapshot
    from jsonb_array_elements(sio.recipe_items_snapshot) as recipe_item
    join public.ingredients i on i.id = (recipe_item ->> 'ingredient_id')::uuid
    left join lateral (
      select ie.avg_price_after
      from public.inventory_events ie
      where ie.user_id = s.user_id
        and ie.ingredient_id = (recipe_item ->> 'ingredient_id')::uuid
        and ie.occurred_at < s.created_at
      order by ie.occurred_at desc, ie.event_seq desc
      limit 1
    ) last_event on true
  ), 0)
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where sio.sale_item_id = si.id
    and s.user_id = v_user_id
    and s.sold_at >= p_from_date;

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
  'Rewrites sale item cost snapshots including option recipe snapshots from inventory replay history, with fallback to current ingredient avg price when no prior event exists.';
