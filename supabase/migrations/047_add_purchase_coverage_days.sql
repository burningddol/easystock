-- Migration: 사용자별 권장 발주 커버일 설정
-- 권장 발주량 계산 시 리드타임 + 안전여유 뒤에 추가로 확보할 운영일 수.

alter table public.users
add column if not exists purchase_coverage_days integer not null default 7;

alter table public.users
drop constraint if exists users_purchase_coverage_days_range;

alter table public.users
add constraint users_purchase_coverage_days_range
check (purchase_coverage_days between 1 and 30);

comment on column public.users.purchase_coverage_days is
  '권장 발주량 계산 시 추가로 확보할 운영일 수. 기본 7일.';

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
  '재고 예측 raw 데이터 반환. 소비 sample, 거래처 식별자, 권장 발주 커버일 설정을 포함한다.';

revoke all on function public.get_depletion_forecast() from public;
grant execute on function public.get_depletion_forecast() to authenticated;
