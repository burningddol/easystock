-- Migration: delete_sale RPC
-- Spec: contracts/domain-rpc.md L134-141, FR-033
--
-- 트랜잭션:
--   1) is_locked 체크 (created_at 기준 7일 초과 reject)
--   2) before_items 스냅샷을 sale_edit_history(change_type='delete')에 기록
--   3) 기존 항목 재고 되돌림 + price history (sale_edit_revert)
--   4) sales DELETE (CASCADE로 sale_items 삭제)
--
-- `#variable_conflict use_column` + 모든 컬럼 alias 명시 (015 헤더 주석 참조).
-- 에러: sale_locked / sale_not_found

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

  select s.id, s.created_at
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
end;
$$;

comment on function public.delete_sale(uuid) is
  '판매 삭제 (FR-033). 7일 lock 체크 → before 스냅샷 history → 재고 되돌림 → CASCADE delete.';

revoke all on function public.delete_sale(uuid) from public;
grant execute on function public.delete_sale(uuid) to authenticated;
