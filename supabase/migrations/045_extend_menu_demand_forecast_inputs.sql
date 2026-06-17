-- Migration: extend menu demand forecast inputs
--
-- Adds base recipe, option recipe, and option selection/attach rates to the
-- menu demand forecast RPC. The client combines these with menu demand
-- predictions to produce ingredient demand forecasts.

create or replace function public.get_menu_demand_forecast()
returns table (
  menu_id uuid,
  name text,
  price numeric,
  is_active boolean,
  base_recipe jsonb,
  option_groups jsonb,
  demand_samples jsonb,
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
  '메뉴별 수요 예측 raw 데이터 반환. 일별 판매 수량, 기본 레시피, 옵션 레시피, 옵션 선택률/부착률을 반환한다.';

revoke all on function public.get_menu_demand_forecast() from public;
grant execute on function public.get_menu_demand_forecast() to authenticated;
