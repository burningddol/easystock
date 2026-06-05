-- Migration: auto replay after sale save/edit/delete
--
-- Ensures retroactive sale changes stay consistent by automatically replaying
-- inventory state and rewriting sale cost snapshots from the affected sold_at.

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
  with sale_anchors as (
    select
      s.id as sale_id,
      s.user_id,
      s.sold_at,
      coalesce((
        select max(ie.event_seq)
        from public.inventory_events ie
        where ie.user_id = s.user_id
          and ie.reference_id = s.id
          and ie.event_type in ('sale_consumption', 'sale_edit_apply')
      ), 9223372036854775807::bigint) as anchor_event_seq
    from public.sales s
    where s.user_id = v_user_id
      and s.sold_at >= p_from_date
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
  join sale_anchors anchor on anchor.sale_id = s.id
  join public.sale_items si on si.sale_id = s.id
  join public.recipe_items ri on ri.menu_id = si.menu_id
  left join lateral (
    select ie.avg_price_after
    from public.inventory_events ie
    where ie.user_id = s.user_id
      and ie.ingredient_id = ri.ingredient_id
      and (
        ie.effective_date < s.sold_at
        or (ie.effective_date = s.sold_at and ie.event_seq < anchor.anchor_event_seq)
      )
    order by ie.effective_date desc, ie.occurred_at desc, ie.event_seq desc
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
  'Rewrites sale item cost snapshots and sale total cost snapshots from inventory replay history using the latest active sale event anchor.';

create or replace function public.run_sale_replay_from_date(
  p_from_date date,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_from_date is null then
    raise exception 'invalid_input: from_date is required' using errcode = '22023';
  end if;

  perform 1
  from public.apply_inventory_replay(p_from_date, p_note);

  perform 1
  from public.apply_sale_snapshot_rewrite(p_from_date, p_note);
end;
$$;

comment on function public.run_sale_replay_from_date(date, text) is
  'Runs inventory replay and sale snapshot rewrite from a sold_at date. Used after retroactive sale writes.';

revoke all on function public.run_sale_replay_from_date(date, text) from public;
grant execute on function public.run_sale_replay_from_date(date, text) to authenticated;

create or replace function public.save_sale(p_sold_at date, p_items jsonb)
returns table (
  sale_id uuid,
  total_revenue numeric,
  total_cost_snapshot numeric,
  total_net_profit numeric,
  margin_percent numeric
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_sale_id uuid;
  v_item jsonb;
  v_menu record;
  v_quantity integer;
  v_menu_cost numeric(14, 4);
  v_total_revenue numeric(14, 2) := 0;
  v_total_cost numeric(14, 4) := 0;
  v_recipe record;
  v_consume numeric(14, 3);
  v_prev_stock numeric(14, 3);
  v_new_stock numeric(14, 3);
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_input: items must be non-empty array' using errcode = '22023';
  end if;

  if p_sold_at > v_today then
    raise exception 'future_date' using errcode = '22023';
  end if;

  if p_sold_at < v_today - interval '7 days' then
    raise exception 'out_of_window' using errcode = '22023';
  end if;

  if exists (select 1 from public.sales s where s.user_id = v_user_id and s.sold_at = p_sold_at) then
    raise exception 'duplicate_sale' using errcode = '23505';
  end if;

  insert into public.sales (user_id, sold_at)
  values (v_user_id, p_sold_at)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'invalid_input: quantity must be positive integer' using errcode = '22023';
    end if;

    select m.id, m.name, m.price, m.is_active
    into v_menu
    from public.menus m
    where m.id = (v_item ->> 'menu_id')::uuid and m.user_id = v_user_id;

    if not found then
      raise exception 'menu_inactive: menu not found or not owned' using errcode = '22023';
    end if;

    if not v_menu.is_active then
      raise exception 'menu_inactive: %', v_menu.name using errcode = '22023';
    end if;

    if not exists (select 1 from public.recipe_items ri where ri.menu_id = v_menu.id) then
      raise exception 'menu_no_recipe: %', v_menu.name using errcode = '22023';
    end if;

    select coalesce(sum(ri.quantity_per_serving * i.current_avg_price), 0)
    into v_menu_cost
    from public.recipe_items ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.menu_id = v_menu.id;

    insert into public.sale_items (sale_id, user_id, menu_id, quantity, unit_price, menu_cost_snapshot)
    values (v_sale_id, v_user_id, v_menu.id, v_quantity, v_menu.price, v_menu_cost);

    v_total_revenue := v_total_revenue + (v_menu.price * v_quantity);
    v_total_cost := v_total_cost + (v_menu_cost * v_quantity);

    for v_recipe in
      select ri.ingredient_id, ri.quantity_per_serving, i.current_stock, i.current_avg_price
      from public.recipe_items ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.menu_id = v_menu.id
    loop
      v_consume := v_recipe.quantity_per_serving * v_quantity;
      v_prev_stock := v_recipe.current_stock;
      v_new_stock := greatest(v_prev_stock - v_consume, 0);

      update public.ingredients
      set current_stock = v_new_stock
      where id = v_recipe.ingredient_id;

      insert into public.ingredient_price_history (
        user_id, ingredient_id, previous_avg_price, new_avg_price,
        previous_stock, new_stock, reason, reference_id
      ) values (
        v_user_id, v_recipe.ingredient_id,
        v_recipe.current_avg_price, v_recipe.current_avg_price,
        v_prev_stock, v_new_stock,
        'sale_consumption', v_sale_id
      );
    end loop;
  end loop;

  update public.sales
  set total_revenue = v_total_revenue,
      total_cost_snapshot = v_total_cost
  where id = v_sale_id;

  perform public.run_sale_replay_from_date(
    p_sold_at,
    format('auto_save_sale:%s', v_sale_id)
  );

  select s.total_revenue, s.total_cost_snapshot
  into v_total_revenue, v_total_cost
  from public.sales s
  where s.id = v_sale_id;

  return query select
    v_sale_id,
    v_total_revenue::numeric,
    v_total_cost::numeric,
    (v_total_revenue - v_total_cost)::numeric,
    case when v_total_revenue = 0 then 0::numeric
         else round(((v_total_revenue - v_total_cost) / v_total_revenue) * 100, 2)
    end;
end;
$$;

comment on function public.save_sale(date, jsonb) is
  '판매 트랜잭셔널 저장 (FR-006). 저장 후 sold_at부터 재고/원가 스냅샷 자동 재계산.';

create or replace function public.edit_sale(
  p_sale_id uuid,
  p_new_items jsonb,
  p_reason text default null
)
returns table (
  sale_id uuid,
  total_revenue numeric,
  total_cost_snapshot numeric,
  total_net_profit numeric,
  margin_percent numeric
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_sale record;
  v_before_items jsonb;
  v_after_items jsonb;
  v_history_id uuid;
  v_old_item record;
  v_new_item jsonb;
  v_quantity integer;
  v_menu record;
  v_menu_cost numeric(14, 4);
  v_total_revenue numeric(14, 2) := 0;
  v_total_cost numeric(14, 4) := 0;
  v_recipe record;
  v_consume numeric(14, 3);
  v_prev_stock numeric(14, 3);
  v_new_stock numeric(14, 3);
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select s.id, s.user_id, s.created_at, s.sold_at
  into v_sale
  from public.sales s
  where s.id = p_sale_id and s.user_id = v_user_id;

  if not found then
    raise exception 'sale_not_found' using errcode = '22023';
  end if;

  if now() - v_sale.created_at > interval '7 days' then
    raise exception 'sale_locked' using errcode = '22023';
  end if;

  if jsonb_typeof(p_new_items) <> 'array' or jsonb_array_length(p_new_items) = 0 then
    raise exception 'invalid_input: new_items must be non-empty array' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'menu_id', si.menu_id,
    'menu_name', m.name,
    'quantity', si.quantity,
    'unit_price', si.unit_price,
    'menu_cost_snapshot', si.menu_cost_snapshot
  )), '[]'::jsonb)
  into v_before_items
  from public.sale_items si
  join public.menus m on m.id = si.menu_id
  where si.sale_id = p_sale_id;

  insert into public.sale_edit_history (sale_id, user_id, change_type, reason, before_items)
  values (p_sale_id, v_user_id, 'edit', p_reason, v_before_items)
  returning id into v_history_id;

  for v_old_item in
    select si.menu_id, si.quantity
    from public.sale_items si
    where si.sale_id = p_sale_id
  loop
    for v_recipe in
      select ri.ingredient_id, ri.quantity_per_serving, i.current_stock, i.current_avg_price
      from public.recipe_items ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.menu_id = v_old_item.menu_id
    loop
      v_consume := v_recipe.quantity_per_serving * v_old_item.quantity;
      v_prev_stock := v_recipe.current_stock;
      v_new_stock := v_prev_stock + v_consume;

      update public.ingredients
      set current_stock = v_new_stock
      where id = v_recipe.ingredient_id;

      insert into public.ingredient_price_history (
        user_id, ingredient_id, previous_avg_price, new_avg_price,
        previous_stock, new_stock, reason, reference_id
      ) values (
        v_user_id, v_recipe.ingredient_id,
        v_recipe.current_avg_price, v_recipe.current_avg_price,
        v_prev_stock, v_new_stock,
        'sale_edit_revert', p_sale_id
      );
    end loop;
  end loop;

  delete from public.sale_items where sale_id = p_sale_id;

  for v_new_item in select * from jsonb_array_elements(p_new_items)
  loop
    v_quantity := (v_new_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'invalid_input: quantity must be positive integer' using errcode = '22023';
    end if;

    select m.id, m.name, m.price, m.is_active
    into v_menu
    from public.menus m
    where m.id = (v_new_item ->> 'menu_id')::uuid and m.user_id = v_user_id;

    if not found then
      raise exception 'menu_inactive: menu not found' using errcode = '22023';
    end if;

    if not v_menu.is_active then
      raise exception 'menu_inactive: %', v_menu.name using errcode = '22023';
    end if;

    if not exists (select 1 from public.recipe_items ri where ri.menu_id = v_menu.id) then
      raise exception 'menu_no_recipe: %', v_menu.name using errcode = '22023';
    end if;

    select coalesce(sum(ri.quantity_per_serving * i.current_avg_price), 0)
    into v_menu_cost
    from public.recipe_items ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.menu_id = v_menu.id;

    insert into public.sale_items (sale_id, user_id, menu_id, quantity, unit_price, menu_cost_snapshot)
    values (p_sale_id, v_user_id, v_menu.id, v_quantity, v_menu.price, v_menu_cost);

    v_total_revenue := v_total_revenue + (v_menu.price * v_quantity);
    v_total_cost := v_total_cost + (v_menu_cost * v_quantity);

    for v_recipe in
      select ri.ingredient_id, ri.quantity_per_serving, i.current_stock, i.current_avg_price
      from public.recipe_items ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.menu_id = v_menu.id
    loop
      v_consume := v_recipe.quantity_per_serving * v_quantity;
      v_prev_stock := v_recipe.current_stock;

      if v_prev_stock < v_consume then
        raise exception 'negative_stock: ingredient_id=%', v_recipe.ingredient_id
          using errcode = '22023';
      end if;

      v_new_stock := v_prev_stock - v_consume;

      update public.ingredients
      set current_stock = v_new_stock
      where id = v_recipe.ingredient_id;

      insert into public.ingredient_price_history (
        user_id, ingredient_id, previous_avg_price, new_avg_price,
        previous_stock, new_stock, reason, reference_id
      ) values (
        v_user_id, v_recipe.ingredient_id,
        v_recipe.current_avg_price, v_recipe.current_avg_price,
        v_prev_stock, v_new_stock,
        'sale_edit_apply', p_sale_id
      );
    end loop;
  end loop;

  update public.sales
  set total_revenue = v_total_revenue,
      total_cost_snapshot = v_total_cost,
      updated_at = now()
  where id = p_sale_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'menu_id', si.menu_id,
    'menu_name', m.name,
    'quantity', si.quantity,
    'unit_price', si.unit_price,
    'menu_cost_snapshot', si.menu_cost_snapshot
  )), '[]'::jsonb)
  into v_after_items
  from public.sale_items si
  join public.menus m on m.id = si.menu_id
  where si.sale_id = p_sale_id;

  update public.sale_edit_history
  set after_items = v_after_items
  where id = v_history_id;

  perform public.run_sale_replay_from_date(
    v_sale.sold_at,
    format('auto_edit_sale:%s', p_sale_id)
  );

  select s.total_revenue, s.total_cost_snapshot
  into v_total_revenue, v_total_cost
  from public.sales s
  where s.id = p_sale_id;

  return query select
    p_sale_id,
    v_total_revenue::numeric,
    v_total_cost::numeric,
    (v_total_revenue - v_total_cost)::numeric,
    case when v_total_revenue = 0 then 0::numeric
         else round(((v_total_revenue - v_total_cost) / v_total_revenue) * 100, 2)
    end;
end;
$$;

comment on function public.edit_sale(uuid, jsonb, text) is
  '판매 편집 (FR-030~033). 저장 후 sold_at부터 재고/원가 스냅샷 자동 재계산.';

create or replace function public.delete_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_sale record;
  v_before_items jsonb;
  v_old_item record;
  v_recipe record;
  v_consume numeric(14, 3);
  v_prev_stock numeric(14, 3);
  v_new_stock numeric(14, 3);
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select s.id, s.created_at, s.sold_at
  into v_sale
  from public.sales s
  where s.id = p_sale_id and s.user_id = v_user_id;

  if not found then
    raise exception 'sale_not_found' using errcode = '22023';
  end if;

  if now() - v_sale.created_at > interval '7 days' then
    raise exception 'sale_locked' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'menu_id', si.menu_id,
    'menu_name', m.name,
    'quantity', si.quantity,
    'unit_price', si.unit_price,
    'menu_cost_snapshot', si.menu_cost_snapshot
  )), '[]'::jsonb)
  into v_before_items
  from public.sale_items si
  join public.menus m on m.id = si.menu_id
  where si.sale_id = p_sale_id;

  insert into public.sale_edit_history (sale_id, user_id, change_type, before_items)
  values (p_sale_id, v_user_id, 'delete', v_before_items);

  for v_old_item in
    select si.menu_id, si.quantity
    from public.sale_items si
    where si.sale_id = p_sale_id
  loop
    for v_recipe in
      select ri.ingredient_id, ri.quantity_per_serving, i.current_stock, i.current_avg_price
      from public.recipe_items ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.menu_id = v_old_item.menu_id
    loop
      v_consume := v_recipe.quantity_per_serving * v_old_item.quantity;
      v_prev_stock := v_recipe.current_stock;
      v_new_stock := v_prev_stock + v_consume;

      update public.ingredients
      set current_stock = v_new_stock
      where id = v_recipe.ingredient_id;

      insert into public.ingredient_price_history (
        user_id, ingredient_id, previous_avg_price, new_avg_price,
        previous_stock, new_stock, reason, reference_id
      ) values (
        v_user_id, v_recipe.ingredient_id,
        v_recipe.current_avg_price, v_recipe.current_avg_price,
        v_prev_stock, v_new_stock,
        'sale_edit_revert', p_sale_id
      );
    end loop;
  end loop;

  delete from public.sales where id = p_sale_id;

  perform public.run_sale_replay_from_date(
    v_sale.sold_at,
    format('auto_delete_sale:%s', p_sale_id)
  );
end;
$$;

comment on function public.delete_sale(uuid) is
  '판매 삭제 (FR-033). 삭제 후 sold_at부터 재고/원가 스냅샷 자동 재계산.';
