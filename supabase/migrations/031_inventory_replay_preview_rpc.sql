-- Migration: inventory replay preview RPC
--
-- This is a read-only rehearsal step for historical recalculation. It enriches
-- inventory_events with replay inputs and exposes a preview RPC that replays
-- events from a business date without mutating ingredients or sales.

create or replace function public.build_inventory_event_metadata(
  p_reason public.price_history_reason,
  p_reference_id uuid,
  p_ingredient_id uuid,
  p_quantity_delta numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_purchase record;
  v_stock_count record;
  v_sale record;
begin
  if p_reason = 'purchase' then
    select
      poi.quantity,
      poi.amount,
      poi.unit_price,
      po.purchased_at
    into v_purchase
    from public.purchase_order_items poi
    join public.purchase_orders po on po.id = poi.purchase_order_id
    where poi.purchase_order_id = p_reference_id
      and poi.ingredient_id = p_ingredient_id
      and abs(poi.quantity - p_quantity_delta) < 0.0005
    order by poi.id
    limit 1;

    if found then
      return jsonb_build_object(
        'purchase_quantity', v_purchase.quantity,
        'purchase_amount', v_purchase.amount,
        'purchase_unit_price', v_purchase.unit_price,
        'purchased_at', v_purchase.purchased_at
      );
    end if;
  elsif p_reason = 'stock_count_correction' then
    select
      sci.actual_stock,
      sci.system_stock_at_count,
      dsc.counted_at
    into v_stock_count
    from public.stock_count_items sci
    join public.daily_stock_counts dsc on dsc.id = sci.stock_count_id
    where sci.stock_count_id = p_reference_id
      and sci.ingredient_id = p_ingredient_id
    order by sci.id
    limit 1;

    if found then
      return jsonb_build_object(
        'actual_stock', v_stock_count.actual_stock,
        'system_stock_at_count', v_stock_count.system_stock_at_count,
        'counted_at', v_stock_count.counted_at
      );
    end if;
  elsif p_reason in ('sale_consumption', 'sale_edit_revert', 'sale_edit_apply') then
    select s.sold_at
    into v_sale
    from public.sales s
    where s.id = p_reference_id;

    if found then
      return jsonb_build_object('sold_at', v_sale.sold_at);
    end if;
  end if;

  return '{}'::jsonb;
end;
$$;

comment on function public.build_inventory_event_metadata(
  public.price_history_reason,
  uuid,
  uuid,
  numeric
) is
  'Builds replay metadata for an inventory event from its source domain record.';

create or replace function public.mirror_price_history_to_inventory_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory_events (
    user_id,
    ingredient_id,
    effective_date,
    occurred_at,
    event_type,
    reference_id,
    price_history_id,
    quantity_delta,
    stock_before,
    stock_after,
    avg_price_before,
    avg_price_after,
    metadata
  ) values (
    new.user_id,
    new.ingredient_id,
    public.resolve_inventory_event_effective_date(new.reason, new.reference_id, new.changed_at),
    new.changed_at,
    new.reason::text::public.inventory_event_type,
    new.reference_id,
    new.id,
    new.new_stock - new.previous_stock,
    new.previous_stock,
    new.new_stock,
    new.previous_avg_price,
    new.new_avg_price,
    jsonb_build_object('source', 'ingredient_price_history')
      || public.build_inventory_event_metadata(
        new.reason,
        new.reference_id,
        new.ingredient_id,
        new.new_stock - new.previous_stock
      )
  );

  return new;
end;
$$;

update public.inventory_events ie
set metadata = ie.metadata
  || public.build_inventory_event_metadata(
    ph.reason,
    ph.reference_id,
    ph.ingredient_id,
    ph.new_stock - ph.previous_stock
  )
from public.ingredient_price_history ph
where ie.price_history_id = ph.id;

create index inventory_events_user_replay_idx
on public.inventory_events (user_id, effective_date, occurred_at, event_seq);

create or replace function public.preview_inventory_replay(p_from_date date)
returns table (
  ingredient_id uuid,
  ingredient_name text,
  unit public.ingredient_unit,
  replayed_stock numeric,
  current_stock numeric,
  stock_delta numeric,
  replayed_avg_price numeric,
  current_avg_price numeric,
  avg_price_delta numeric,
  event_count integer,
  first_event_date date,
  last_event_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event record;
  v_state record;
  v_next_stock numeric(12, 3);
  v_next_avg numeric(12, 4);
  v_purchase_unit_price numeric(12, 4);
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_from_date is null then
    raise exception 'invalid_input: from_date is required' using errcode = '22023';
  end if;

  create temporary table if not exists inventory_replay_state (
    ingredient_id uuid primary key,
    replayed_stock numeric(12, 3) not null,
    replayed_avg_price numeric(12, 4) not null,
    event_count integer not null,
    first_event_date date not null,
    last_event_date date not null
  ) on commit drop;

  truncate table inventory_replay_state;

  for v_event in
    select *
    from public.inventory_events ie
    where ie.user_id = v_user_id
      and ie.effective_date >= p_from_date
    order by ie.ingredient_id, ie.effective_date, ie.occurred_at, ie.event_seq
  loop
    select *
    into v_state
    from inventory_replay_state s
    where s.ingredient_id = v_event.ingredient_id;

    if not found then
      insert into inventory_replay_state (
        ingredient_id,
        replayed_stock,
        replayed_avg_price,
        event_count,
        first_event_date,
        last_event_date
      ) values (
        v_event.ingredient_id,
        v_event.stock_before,
        v_event.avg_price_before,
        0,
        v_event.effective_date,
        v_event.effective_date
      );

      select *
      into v_state
      from inventory_replay_state s
      where s.ingredient_id = v_event.ingredient_id;
    end if;

    if v_event.event_type = 'purchase' then
      v_purchase_unit_price := nullif(v_event.metadata ->> 'purchase_unit_price', '')::numeric;
      if v_purchase_unit_price is null then
        v_purchase_unit_price := v_event.avg_price_after;
      end if;

      v_next_stock := v_state.replayed_stock + v_event.quantity_delta;
      if v_state.replayed_stock = 0 then
        v_next_avg := v_purchase_unit_price;
      elsif v_next_stock = 0 then
        v_next_avg := v_purchase_unit_price;
      else
        v_next_avg := (
          v_state.replayed_stock * v_state.replayed_avg_price
          + v_event.quantity_delta * v_purchase_unit_price
        ) / v_next_stock;
      end if;
    elsif v_event.event_type = 'stock_count_correction' then
      v_next_stock := v_event.stock_after;
      v_next_avg := v_state.replayed_avg_price;
    else
      v_next_stock := v_state.replayed_stock + v_event.quantity_delta;
      v_next_avg := v_state.replayed_avg_price;
    end if;

    update inventory_replay_state as state
    set replayed_stock = v_next_stock,
        replayed_avg_price = v_next_avg,
        event_count = state.event_count + 1,
        last_event_date = v_event.effective_date
    where state.ingredient_id = v_event.ingredient_id;
  end loop;

  return query
  select
    i.id,
    i.name,
    i.unit,
    s.replayed_stock,
    i.current_stock,
    s.replayed_stock - i.current_stock,
    s.replayed_avg_price,
    i.current_avg_price,
    s.replayed_avg_price - i.current_avg_price,
    s.event_count,
    s.first_event_date,
    s.last_event_date
  from inventory_replay_state s
  join public.ingredients i on i.id = s.ingredient_id
  where i.user_id = v_user_id
  order by i.name;
end;
$$;

comment on function public.preview_inventory_replay(date) is
  'Read-only inventory replay preview from a business date. Does not mutate ingredients or historical sales.';

revoke all on function public.preview_inventory_replay(date) from public;
grant execute on function public.preview_inventory_replay(date) to authenticated;
