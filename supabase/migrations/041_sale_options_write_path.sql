-- Migration: wire menu options into sale write path
--
-- Options are stored as sale-time snapshots and included in revenue, cost,
-- inventory consumption, sale edit history, snapshot replay, and depletion
-- forecast raw consumption samples.

create or replace function public.build_sale_items_snapshot(p_sale_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'menu_id', si.menu_id,
    'menu_name', m.name,
    'quantity', si.quantity,
    'unit_price', si.unit_price,
    'menu_cost_snapshot', si.menu_cost_snapshot,
    'options', coalesce(options.options, '[]'::jsonb)
  ) order by m.name), '[]'::jsonb)
  from public.sale_items si
  join public.menus m on m.id = si.menu_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'option_group_id', sio.option_group_id,
      'option_value_id', sio.option_value_id,
      'quantity', sio.quantity,
      'group_name_snapshot', sio.group_name_snapshot,
      'value_name_snapshot', sio.value_name_snapshot,
      'price_delta_snapshot', sio.price_delta_snapshot,
      'option_cost_snapshot', sio.option_cost_snapshot,
      'recipe_items_snapshot', sio.recipe_items_snapshot
    ) order by sio.group_name_snapshot, sio.value_name_snapshot) as options
    from public.sale_item_options sio
    where sio.sale_item_id = si.id
  ) options on true
  where si.sale_id = p_sale_id;
$$;

create or replace function public.insert_sale_item_option_snapshots(
  p_sale_item_id uuid,
  p_menu_id uuid,
  p_item jsonb,
  p_user_id uuid,
  p_menu_quantity integer
)
returns table (
  total_price_delta numeric,
  total_option_cost numeric
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_options jsonb := coalesce(p_item -> 'options', '[]'::jsonb);
  v_option_payload jsonb;
  v_option_value_id uuid;
  v_option_quantity integer;
  v_option record;
  v_recipe_snapshot jsonb;
  v_option_cost numeric(14, 4);
  v_group record;
  v_selected_quantity integer;
  v_total_price_delta numeric(14, 2) := 0;
  v_total_option_cost numeric(14, 4) := 0;
begin
  if jsonb_typeof(v_options) <> 'array' then
    raise exception 'invalid_input: options must be array' using errcode = '22023';
  end if;

  for v_option_payload in select * from jsonb_array_elements(v_options)
  loop
    v_option_value_id := (v_option_payload ->> 'option_value_id')::uuid;
    v_option_quantity := (v_option_payload ->> 'quantity')::integer;

    if v_option_value_id is null then
      raise exception 'invalid_input: option_value_id is required' using errcode = '22023';
    end if;

    if v_option_quantity is null or v_option_quantity <= 0 then
      raise exception 'invalid_input: option quantity must be positive integer' using errcode = '22023';
    end if;

    select
      og.id as option_group_id,
      og.name as group_name,
      ov.id as option_value_id,
      ov.name as value_name,
      ov.price_delta
    into v_option
    from public.menu_option_values ov
    join public.menu_option_groups og on og.id = ov.option_group_id
    where ov.id = v_option_value_id
      and ov.user_id = p_user_id
      and og.user_id = p_user_id
      and og.menu_id = p_menu_id
      and ov.is_active = true
      and og.is_active = true;

    if not found then
      raise exception 'option_not_found: option_value_id=%', v_option_value_id using errcode = '22023';
    end if;

    select
      coalesce(jsonb_agg(jsonb_build_object(
        'ingredient_id', ovr.ingredient_id,
        'quantity_per_selection', ovr.quantity_per_selection,
        'avg_price_snapshot', i.current_avg_price
      ) order by ovr.ingredient_id), '[]'::jsonb),
      coalesce(sum(ovr.quantity_per_selection * i.current_avg_price), 0)::numeric(14, 4)
    into v_recipe_snapshot, v_option_cost
    from public.menu_option_value_recipe_items ovr
    join public.ingredients i on i.id = ovr.ingredient_id
    where ovr.option_value_id = v_option.option_value_id
      and ovr.user_id = p_user_id;

    insert into public.sale_item_options (
      sale_item_id,
      user_id,
      option_group_id,
      option_value_id,
      quantity,
      group_name_snapshot,
      value_name_snapshot,
      price_delta_snapshot,
      option_cost_snapshot,
      recipe_items_snapshot
    ) values (
      p_sale_item_id,
      p_user_id,
      v_option.option_group_id,
      v_option.option_value_id,
      v_option_quantity,
      v_option.group_name,
      v_option.value_name,
      v_option.price_delta,
      v_option_cost,
      v_recipe_snapshot
    );

    v_total_price_delta := v_total_price_delta + (v_option.price_delta * v_option_quantity);
    v_total_option_cost := v_total_option_cost + (v_option_cost * v_option_quantity);
  end loop;

  for v_group in
    select id, selection_type, is_required, min_select, max_select
    from public.menu_option_groups
    where menu_id = p_menu_id
      and user_id = p_user_id
      and is_active = true
  loop
    select coalesce(sum(sio.quantity), 0)::integer
    into v_selected_quantity
    from public.sale_item_options sio
    where sio.sale_item_id = p_sale_item_id
      and sio.option_group_id = v_group.id;

    if v_group.is_required and v_selected_quantity < p_menu_quantity then
      raise exception 'required_option_missing: option_group_id=%', v_group.id using errcode = '22023';
    end if;

    if v_selected_quantity < (v_group.min_select * p_menu_quantity) then
      raise exception 'option_min_not_met: option_group_id=%', v_group.id using errcode = '22023';
    end if;

    if v_group.max_select is not null and v_selected_quantity > (v_group.max_select * p_menu_quantity) then
      raise exception 'option_max_exceeded: option_group_id=%', v_group.id using errcode = '22023';
    end if;

    if v_group.selection_type = 'single' and v_selected_quantity <> 0 and v_selected_quantity <> p_menu_quantity then
      raise exception 'single_option_must_match_menu_quantity: option_group_id=%', v_group.id using errcode = '22023';
    end if;
  end loop;

  return query select v_total_price_delta::numeric, v_total_option_cost::numeric;
end;
$$;

create or replace function public.apply_sale_item_inventory_delta(
  p_sale_item_id uuid,
  p_sale_id uuid,
  p_user_id uuid,
  p_direction integer,
  p_reason public.price_history_reason
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe record;
  v_consume numeric(14, 3);
  v_prev_stock numeric(14, 3);
  v_new_stock numeric(14, 3);
begin
  if p_direction not in (-1, 1) then
    raise exception 'invalid_input: direction must be -1 or 1' using errcode = '22023';
  end if;

  for v_recipe in
    select
      ri.ingredient_id,
      (ri.quantity_per_serving * si.quantity)::numeric(14, 3) as quantity,
      i.current_stock,
      i.current_avg_price
    from public.sale_items si
    join public.recipe_items ri on ri.menu_id = si.menu_id
    join public.ingredients i on i.id = ri.ingredient_id
    where si.id = p_sale_item_id
      and si.user_id = p_user_id
  loop
    v_consume := v_recipe.quantity;
    v_prev_stock := v_recipe.current_stock;

    if p_direction = -1 and v_prev_stock < v_consume then
      raise exception 'negative_stock: ingredient_id=%', v_recipe.ingredient_id using errcode = '22023';
    end if;

    v_new_stock := v_prev_stock + (p_direction * v_consume);

    update public.ingredients
    set current_stock = v_new_stock
    where id = v_recipe.ingredient_id;

    insert into public.ingredient_price_history (
      user_id, ingredient_id, previous_avg_price, new_avg_price,
      previous_stock, new_stock, reason, reference_id
    ) values (
      p_user_id, v_recipe.ingredient_id,
      v_recipe.current_avg_price, v_recipe.current_avg_price,
      v_prev_stock, v_new_stock,
      p_reason, p_sale_id
    );
  end loop;

  for v_recipe in
    select
      (recipe_item ->> 'ingredient_id')::uuid as ingredient_id,
      sum(((recipe_item ->> 'quantity_per_selection')::numeric * sio.quantity))::numeric(14, 3) as quantity,
      i.current_stock,
      i.current_avg_price
    from public.sale_item_options sio
    cross join lateral jsonb_array_elements(sio.recipe_items_snapshot) as recipe_item
    join public.ingredients i on i.id = (recipe_item ->> 'ingredient_id')::uuid
    where sio.sale_item_id = p_sale_item_id
      and sio.user_id = p_user_id
    group by (recipe_item ->> 'ingredient_id')::uuid, i.current_stock, i.current_avg_price
  loop
    v_consume := v_recipe.quantity;
    v_prev_stock := v_recipe.current_stock;

    if p_direction = -1 and v_prev_stock < v_consume then
      raise exception 'negative_stock: ingredient_id=%', v_recipe.ingredient_id using errcode = '22023';
    end if;

    v_new_stock := v_prev_stock + (p_direction * v_consume);

    update public.ingredients
    set current_stock = v_new_stock
    where id = v_recipe.ingredient_id;

    insert into public.ingredient_price_history (
      user_id, ingredient_id, previous_avg_price, new_avg_price,
      previous_stock, new_stock, reason, reference_id
    ) values (
      p_user_id, v_recipe.ingredient_id,
      v_recipe.current_avg_price, v_recipe.current_avg_price,
      v_prev_stock, v_new_stock,
      p_reason, p_sale_id
    );
  end loop;
end;
$$;

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
  v_sale_item_id uuid;
  v_item jsonb;
  v_menu record;
  v_quantity integer;
  v_base_menu_cost numeric(14, 4);
  v_option_totals record;
  v_unit_price_snapshot numeric(14, 4);
  v_menu_cost_snapshot numeric(14, 4);
  v_total_revenue numeric(14, 2) := 0;
  v_total_cost numeric(14, 4) := 0;
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
    into v_base_menu_cost
    from public.recipe_items ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.menu_id = v_menu.id;

    insert into public.sale_items (sale_id, user_id, menu_id, quantity, unit_price, menu_cost_snapshot)
    values (v_sale_id, v_user_id, v_menu.id, v_quantity, v_menu.price, v_base_menu_cost)
    returning id into v_sale_item_id;

    select *
    into v_option_totals
    from public.insert_sale_item_option_snapshots(
      v_sale_item_id,
      v_menu.id,
      v_item,
      v_user_id,
      v_quantity
    );

    v_unit_price_snapshot := ((v_menu.price * v_quantity) + v_option_totals.total_price_delta) / v_quantity;
    v_menu_cost_snapshot := ((v_base_menu_cost * v_quantity) + v_option_totals.total_option_cost) / v_quantity;

    update public.sale_items
    set unit_price = v_unit_price_snapshot,
        menu_cost_snapshot = v_menu_cost_snapshot
    where id = v_sale_item_id;

    v_total_revenue := v_total_revenue + (v_unit_price_snapshot * v_quantity);
    v_total_cost := v_total_cost + (v_menu_cost_snapshot * v_quantity);

    perform public.apply_sale_item_inventory_delta(
      v_sale_item_id,
      v_sale_id,
      v_user_id,
      -1,
      'sale_consumption'
    );
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
  '판매 저장. 옵션 스냅샷/옵션 재료 차감까지 포함하고, 저장 후 sold_at부터 재고/원가 스냅샷 자동 재계산.';

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
  v_sale_item_id uuid;
  v_quantity integer;
  v_menu record;
  v_base_menu_cost numeric(14, 4);
  v_option_totals record;
  v_unit_price_snapshot numeric(14, 4);
  v_menu_cost_snapshot numeric(14, 4);
  v_total_revenue numeric(14, 2) := 0;
  v_total_cost numeric(14, 4) := 0;
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

  v_before_items := public.build_sale_items_snapshot(p_sale_id);

  insert into public.sale_edit_history (sale_id, user_id, change_type, reason, before_items)
  values (p_sale_id, v_user_id, 'edit', p_reason, v_before_items)
  returning id into v_history_id;

  for v_old_item in
    select si.id
    from public.sale_items si
    where si.sale_id = p_sale_id
  loop
    perform public.apply_sale_item_inventory_delta(
      v_old_item.id,
      p_sale_id,
      v_user_id,
      1,
      'sale_edit_revert'
    );
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
    into v_base_menu_cost
    from public.recipe_items ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.menu_id = v_menu.id;

    insert into public.sale_items (sale_id, user_id, menu_id, quantity, unit_price, menu_cost_snapshot)
    values (p_sale_id, v_user_id, v_menu.id, v_quantity, v_menu.price, v_base_menu_cost)
    returning id into v_sale_item_id;

    select *
    into v_option_totals
    from public.insert_sale_item_option_snapshots(
      v_sale_item_id,
      v_menu.id,
      v_new_item,
      v_user_id,
      v_quantity
    );

    v_unit_price_snapshot := ((v_menu.price * v_quantity) + v_option_totals.total_price_delta) / v_quantity;
    v_menu_cost_snapshot := ((v_base_menu_cost * v_quantity) + v_option_totals.total_option_cost) / v_quantity;

    update public.sale_items
    set unit_price = v_unit_price_snapshot,
        menu_cost_snapshot = v_menu_cost_snapshot
    where id = v_sale_item_id;

    v_total_revenue := v_total_revenue + (v_unit_price_snapshot * v_quantity);
    v_total_cost := v_total_cost + (v_menu_cost_snapshot * v_quantity);

    perform public.apply_sale_item_inventory_delta(
      v_sale_item_id,
      p_sale_id,
      v_user_id,
      -1,
      'sale_edit_apply'
    );
  end loop;

  update public.sales
  set total_revenue = v_total_revenue,
      total_cost_snapshot = v_total_cost,
      updated_at = now()
  where id = p_sale_id;

  v_after_items := public.build_sale_items_snapshot(p_sale_id);

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
  '판매 편집. 옵션 스냅샷/옵션 재료를 포함해 revert + reapply 후 sold_at부터 자동 재계산.';

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

  v_before_items := public.build_sale_items_snapshot(p_sale_id);

  insert into public.sale_edit_history (sale_id, user_id, change_type, before_items)
  values (p_sale_id, v_user_id, 'delete', v_before_items);

  for v_old_item in
    select si.id
    from public.sale_items si
    where si.sale_id = p_sale_id
  loop
    perform public.apply_sale_item_inventory_delta(
      v_old_item.id,
      p_sale_id,
      v_user_id,
      1,
      'sale_edit_revert'
    );
  end loop;

  delete from public.sales where id = p_sale_id;

  perform public.run_sale_replay_from_date(
    v_sale.sold_at,
    format('auto_delete_sale:%s', p_sale_id)
  );
end;
$$;

comment on function public.delete_sale(uuid) is
  '판매 삭제. 옵션 재료까지 재고 복구 후 sold_at부터 자동 재계산.';

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
    select coalesce(sum(ri.quantity_per_serving * coalesce(last_event.avg_price_after, 0)), 0)::numeric(14, 4) as base_cost
    from public.recipe_items ri
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
      * coalesce(last_event.avg_price_after, 0)
    ), 0)::numeric(14, 4) as option_cost_total
    from public.sale_item_options sio
    cross join lateral jsonb_array_elements(sio.recipe_items_snapshot) as recipe_item
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
      * coalesce(last_event.avg_price_after, 0)
    ), 0)::numeric(14, 4) as option_cost_snapshot
    from jsonb_array_elements(sio.recipe_items_snapshot) as recipe_item
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
  'Rewrites sale item cost snapshots including option recipe snapshots from inventory replay history.';

create or replace function public.get_depletion_forecast()
returns table (
  ingredient_id uuid,
  name text,
  unit public.ingredient_unit,
  current_stock numeric,
  lead_time_days integer,
  lead_time_vendor_name text,
  is_default_lead_time boolean,
  safety_buffer_days integer,
  consumption_samples jsonb,
  signed_up_at timestamptz,
  regular_days_off public.weekday[]
)
language plpgsql
security definer
stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return query
  with vendor_choice as (
    select
      i.id as ingredient_id,
      choice.vendor_name,
      choice.lead_time_days
    from public.ingredients i
    left join lateral (
      select
        v.name as vendor_name,
        v.lead_time_days
      from public.purchase_orders po
      join public.vendors v on v.id = po.vendor_id
      join public.purchase_order_items poi on poi.purchase_order_id = po.id
      where poi.ingredient_id = i.id
        and po.user_id = v_user_id
      group by v.id, v.name, v.lead_time_days
      order by count(*) desc, max(po.purchased_at) desc, v.name asc
      limit 1
    ) choice on true
    where i.user_id = v_user_id
      and i.is_active = true
  )
  select
    i.id,
    i.name,
    i.unit,
    i.current_stock,
    coalesce(vc.lead_time_days, 1) as lead_time_days,
    vc.vendor_name as lead_time_vendor_name,
    (vc.lead_time_days is null) as is_default_lead_time,
    u.safety_buffer_days,
    coalesce(
      (select jsonb_agg(jsonb_build_object('date', day, 'amount', total) order by day)
       from (
         select day, sum(total)::numeric as total
         from (
           select
             s.sold_at as day,
             sum(si.quantity * ri.quantity_per_serving) as total
           from public.sales s
           join public.sale_items si on si.sale_id = s.id
           join public.recipe_items ri on ri.menu_id = si.menu_id
           where ri.ingredient_id = i.id
             and s.user_id = v_user_id
             and s.sold_at >= current_date - interval '90 days'
           group by s.sold_at

           union all

           select
             s.sold_at as day,
             sum(sio.quantity * ((recipe_item ->> 'quantity_per_selection')::numeric)) as total
           from public.sales s
           join public.sale_items si on si.sale_id = s.id
           join public.sale_item_options sio on sio.sale_item_id = si.id
           cross join lateral jsonb_array_elements(sio.recipe_items_snapshot) as recipe_item
           where (recipe_item ->> 'ingredient_id')::uuid = i.id
             and s.user_id = v_user_id
             and s.sold_at >= current_date - interval '90 days'
           group by s.sold_at
         ) raw_daily
         group by day
       ) daily),
      '[]'::jsonb
    ) as consumption_samples,
    u.signed_up_at,
    u.regular_days_off
  from public.ingredients i
  join public.users u on u.id = i.user_id
  left join vendor_choice vc on vc.ingredient_id = i.id
  where i.user_id = v_user_id
    and i.is_active = true
  order by i.name;
end;
$$;

comment on function public.get_depletion_forecast() is
  '재고 예측 raw 데이터 반환. 기본 메뉴 레시피와 옵션 레시피 소비 sample을 함께 포함한다.';

revoke all on function public.build_sale_items_snapshot(uuid) from public;
revoke all on function public.insert_sale_item_option_snapshots(uuid, uuid, jsonb, uuid, integer) from public;
revoke all on function public.apply_sale_item_inventory_delta(uuid, uuid, uuid, integer, public.price_history_reason) from public;
