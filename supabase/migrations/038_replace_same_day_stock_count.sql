-- Migration: 같은 날짜 재고 실사는 기존 실사를 교체
-- 기존 unique 제약은 유지하되, apply_stock_count가 same-day save를 edit처럼 처리한다.

create or replace function public.apply_stock_count(
  p_counted_at date,
  p_items jsonb
)
returns table (
  stock_count_id uuid,
  weekly_loss_amount numeric,
  item_differences jsonb
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_count_id uuid;
  v_is_replace boolean := false;
  v_total_loss numeric(14, 4) := 0;
  v_item jsonb;
  v_ingredient record;
  v_previous_system_stock numeric(12, 3);
  v_system_stock numeric(12, 3);
  v_actual numeric(12, 3);
  v_diff numeric(14, 3);
  v_loss numeric(14, 4);
  v_diffs jsonb := '[]'::jsonb;
  v_replay_result record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_input: items must be non-empty array' using errcode = '22023';
  end if;

  select sc.id
  into v_count_id
  from public.daily_stock_counts sc
  where sc.user_id = v_user_id
    and sc.counted_at = p_counted_at
  limit 1;

  if found then
    v_is_replace := true;

    create temporary table if not exists tmp_previous_stock_count_items (
      ingredient_id uuid primary key,
      system_stock_at_count numeric(12, 3) not null
    ) on commit drop;

    truncate table tmp_previous_stock_count_items;

    insert into tmp_previous_stock_count_items (ingredient_id, system_stock_at_count)
    select sci.ingredient_id, sci.system_stock_at_count
    from public.stock_count_items sci
    where sci.stock_count_id = v_count_id;

    delete from public.inventory_events ie
    where ie.user_id = v_user_id
      and ie.reference_id = v_count_id
      and ie.event_type = 'stock_count_correction';

    delete from public.ingredient_price_history iph
    where iph.user_id = v_user_id
      and iph.reference_id = v_count_id
      and iph.reason = 'stock_count_correction';

    delete from public.stock_count_items sci
    where sci.user_id = v_user_id
      and sci.stock_count_id = v_count_id;
  else
    insert into public.daily_stock_counts (user_id, counted_at)
    values (v_user_id, p_counted_at)
    returning id into v_count_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_actual := (v_item ->> 'actual_stock')::numeric;
    if v_actual is null or v_actual < 0 then
      raise exception 'invalid_input: actual_stock must be >= 0' using errcode = '22023';
    end if;

    select i.id, i.name, i.current_stock, i.current_avg_price
    into v_ingredient
    from public.ingredients i
    where i.id = (v_item ->> 'ingredient_id')::uuid and i.user_id = v_user_id;

    if not found then
      raise exception 'ingredient_not_found' using errcode = '22023';
    end if;

    v_previous_system_stock := null;
    if v_is_replace then
      select system_stock_at_count
      into v_previous_system_stock
      from tmp_previous_stock_count_items
      where ingredient_id = v_ingredient.id;
    end if;

    v_system_stock := coalesce(v_previous_system_stock, v_ingredient.current_stock);
    v_diff := v_system_stock - v_actual;
    v_loss := v_diff * v_ingredient.current_avg_price;

    insert into public.stock_count_items (
      stock_count_id, user_id, ingredient_id,
      actual_stock, system_stock_at_count, weekly_loss_amount
    ) values (
      v_count_id, v_user_id, v_ingredient.id,
      v_actual, v_system_stock, v_loss
    );

    update public.ingredients
    set current_stock = v_actual,
        updated_at = now()
    where id = v_ingredient.id;

    insert into public.ingredient_price_history (
      user_id, ingredient_id, previous_avg_price, new_avg_price,
      previous_stock, new_stock, reason, reference_id
    ) values (
      v_user_id, v_ingredient.id,
      v_ingredient.current_avg_price, v_ingredient.current_avg_price,
      v_system_stock, v_actual,
      'stock_count_correction', v_count_id
    );

    v_total_loss := v_total_loss + v_loss;
    v_diffs := v_diffs || jsonb_build_object(
      'ingredient_id', v_ingredient.id,
      'name', v_ingredient.name,
      'system_stock', v_system_stock,
      'actual_stock', v_actual,
      'diff', v_diff,
      'loss_amount', v_loss
    );
  end loop;

  if v_is_replace then
    select *
    into v_replay_result
    from public.apply_inventory_replay(
      p_counted_at,
      'same_day_stock_count_replace'
    );
  end if;

  return query select v_count_id, v_total_loss, v_diffs;
end;
$$;

comment on function public.apply_stock_count(date, jsonb) is
  '재고 실사 적용. 같은 날짜 재저장은 기존 실사를 교체하고 필요 시 inventory replay를 다시 적용한다.';
