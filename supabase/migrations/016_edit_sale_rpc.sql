-- Migration: edit_sale RPC (판매 편집)
-- Spec: contracts/domain-rpc.md L103-130, FR-030~033
--
-- 입력: { sale_id, reason?, new_items: [{ menu_id, quantity }] }
-- 출력: save_sale과 동일 형식
--
-- 트랜잭션:
--   1) is_locked 체크 (created_at 기준 7일 초과 reject)
--   2) sale_edit_history insert (before_items 스냅샷)
--   3) 기존 sale_items 재고 되돌림 + price history (sale_edit_revert)
--   4) sale_items 삭제 후 새 항목 INSERT (새 menu_cost_snapshot)
--   5) 새 항목 재고 차감 + price history (sale_edit_apply)
--   6) sales totals UPDATE
--   7) edit_history.after_items 채움
--
-- `#variable_conflict use_column` + 모든 컬럼 alias 명시 (015 헤더 주석 참조).
-- 에러: sale_locked / sale_not_found / negative_stock / 기타 save_sale과 동일

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

  select s.id, s.user_id, s.created_at
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
  '판매 편집 (FR-030~033). 7일 lock 체크 → before 스냅샷 → revert → 새 항목 + apply.';

revoke all on function public.edit_sale(uuid, jsonb, text) from public;
grant execute on function public.edit_sale(uuid, jsonb, text) to authenticated;
