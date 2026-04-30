-- Migration: save_sale RPC (트랜잭셔널 판매 저장)
-- Spec: contracts/domain-rpc.md L61-99, FR-006~011, 헌법 III (스냅샷)
--
-- 입력: { sold_at, items: [{ menu_id, quantity }] }
-- 출력: { sale_id, total_revenue, total_cost_snapshot, total_net_profit, margin_percent }
--
-- 트랜잭션:
--   1) 활성 메뉴 + 본인 소유 검증, sold_at 윈도우 검증
--   2) 메뉴별 menu_cost_snapshot 계산 (Σ recipe × ingredient.current_avg_price)
--   3) sales + sale_items INSERT
--   4) 재료 자동 차감 (current_stock -= recipe × quantity, 음수 시 0 보정)
--   5) ingredient_price_history 기록 (reason='sale_consumption')
--
-- `#variable_conflict use_column` + 모든 컬럼 참조에 테이블 alias 명시:
-- RETURNS TABLE 출력 컬럼명이 sales/sale_items의 동일명 컬럼과 ambiguity를
-- 일으키므로 plpgsql 컴파일 시점에 컬럼 우선 해소 + 명시적 alias로 안전 확보.
--
-- 에러 코드 (호출 측이 분기):
--   menu_inactive / menu_no_recipe / future_date / out_of_window /
--   duplicate_sale / not_authenticated / invalid_input

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
  '판매 트랜잭셔널 저장 (FR-006). 메뉴 원가/판매가 스냅샷 영구 보존 (헌법 III), 재료 자동 차감.';

revoke all on function public.save_sale(date, jsonb) from public;
grant execute on function public.save_sale(date, jsonb) to authenticated;
