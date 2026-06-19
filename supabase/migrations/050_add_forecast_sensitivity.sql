-- Migration: 사용자별 예측 민감도 설정
-- 최근 판매 변화를 예측에 얼마나 빠르게 반영할지 선택한다.

alter table public.users
add column if not exists forecast_sensitivity text not null default 'balanced';

alter table public.users
drop constraint if exists users_forecast_sensitivity_check;

alter table public.users
add constraint users_forecast_sensitivity_check
check (forecast_sensitivity in ('stable', 'balanced', 'responsive'));

comment on column public.users.forecast_sensitivity is
  '예측 민감도. stable=완만, balanced=기본, responsive=최근 변화 빠른 반영.';

drop function if exists public.get_depletion_forecast();

create function public.get_depletion_forecast()
returns table (
  ingredient_id uuid,
  name text,
  unit public.ingredient_unit,
  current_stock numeric,
  lead_time_days integer,
  lead_time_vendor_id uuid,
  lead_time_vendor_name text,
  is_default_lead_time boolean,
  safety_buffer_days integer,
  purchase_coverage_days integer,
  forecast_sensitivity text,
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
      choice.vendor_id,
      choice.vendor_name,
      choice.lead_time_days
    from public.ingredients i
    left join lateral (
      select
        v.id as vendor_id,
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
    vc.vendor_id as lead_time_vendor_id,
    vc.vendor_name as lead_time_vendor_name,
    (vc.lead_time_days is null) as is_default_lead_time,
    u.safety_buffer_days,
    u.purchase_coverage_days,
    u.forecast_sensitivity,
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
  '재고 예측 raw 데이터 반환. 소비 sample, 거래처 식별자, 권장 발주 커버일, 예측 민감도 설정을 포함한다.';

revoke all on function public.get_depletion_forecast() from public;
grant execute on function public.get_depletion_forecast() to authenticated;

drop function if exists public.get_menu_demand_forecast();

create function public.get_menu_demand_forecast()
returns table (
  menu_id uuid,
  name text,
  price numeric,
  is_active boolean,
  base_recipe jsonb,
  option_groups jsonb,
  demand_samples jsonb,
  forecast_sensitivity text,
  signed_up_at timestamptz,
  regular_days_off public.weekday[]
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return query
  with menu_sales as (
    select
      si.menu_id,
      sum(si.quantity)::numeric as total_quantity
    from public.sales s
    join public.sale_items si on si.sale_id = s.id
    where s.user_id = v_user_id
      and s.sold_at >= current_date - interval '90 days'
    group by si.menu_id
  ),
  option_sales as (
    select
      si.menu_id,
      sio.option_value_id,
      sum(sio.quantity)::numeric as selected_quantity
    from public.sales s
    join public.sale_items si on si.sale_id = s.id
    join public.sale_item_options sio on sio.sale_item_id = si.id
    where s.user_id = v_user_id
      and s.sold_at >= current_date - interval '90 days'
    group by si.menu_id, sio.option_value_id
  )
  select
    m.id,
    m.name,
    m.price,
    m.is_active,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'ingredient_id', ri.ingredient_id,
          'quantity_per_serving', ri.quantity_per_serving
        ) order by ri.ingredient_id)
        from public.recipe_items ri
        where ri.menu_id = m.id
      ),
      '[]'::jsonb
    ) as base_recipe,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'option_group_id', og.id,
          'name', og.name,
          'selection_type', og.selection_type,
          'is_required', og.is_required,
          'values', coalesce(values_json.values, '[]'::jsonb)
        ) order by og.sort_order, og.name)
        from public.menu_option_groups og
        left join menu_sales ms on ms.menu_id = m.id
        left join lateral (
          select jsonb_agg(jsonb_build_object(
            'option_value_id', ov.id,
            'name', ov.name,
            'is_default', ov.is_default,
            'selection_rate', case
              when coalesce(ms.total_quantity, 0) > 0
                then coalesce(os.selected_quantity, 0) / ms.total_quantity
              else 0
            end,
            'recipe', coalesce(recipe_json.recipe, '[]'::jsonb)
          ) order by ov.sort_order, ov.name) as values
          from public.menu_option_values ov
          left join option_sales os on os.option_value_id = ov.id and os.menu_id = m.id
          left join lateral (
            select jsonb_agg(jsonb_build_object(
              'ingredient_id', ovr.ingredient_id,
              'quantity_per_selection', ovr.quantity_per_selection
            ) order by ovr.ingredient_id) as recipe
            from public.menu_option_value_recipe_items ovr
            where ovr.option_value_id = ov.id
              and ovr.user_id = v_user_id
          ) recipe_json on true
          where ov.option_group_id = og.id
            and ov.user_id = v_user_id
            and ov.is_active = true
        ) values_json on true
        where og.menu_id = m.id
          and og.user_id = v_user_id
          and og.is_active = true
      ),
      '[]'::jsonb
    ) as option_groups,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('date', sold_at, 'quantity', quantity) order by sold_at)
        from (
          select
            s.sold_at,
            sum(si.quantity)::integer as quantity
          from public.sales s
          join public.sale_items si on si.sale_id = s.id
          where s.user_id = v_user_id
            and si.menu_id = m.id
            and s.sold_at >= current_date - interval '90 days'
          group by s.sold_at
        ) daily
      ),
      '[]'::jsonb
    ) as demand_samples,
    u.forecast_sensitivity,
    u.signed_up_at,
    u.regular_days_off
  from public.menus m
  join public.users u on u.id = m.user_id
  where m.user_id = v_user_id
    and m.is_active = true
  order by m.name;
end;
$$;

comment on function public.get_menu_demand_forecast() is
  '메뉴별 수요 예측 raw 데이터 반환. 판매 수량, 레시피, 옵션 선택률, 예측 민감도 설정을 반환한다.';

revoke all on function public.get_menu_demand_forecast() from public;
grant execute on function public.get_menu_demand_forecast() to authenticated;
