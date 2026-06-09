-- Migration: get_depletion_forecast RPC에 리드타임 출처 정보 추가
-- 예측 UI에서 "기본 1일" fallback인지, 어느 거래처 기준인지 바로 설명할 수 있게 한다.

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
      (select jsonb_agg(jsonb_build_object('date', day, 'amount', total))
       from (
         select
           s.sold_at as day,
           sum(si.quantity * ri.quantity_per_serving) as total
         from public.sales s
         join public.sale_items si on si.sale_id = s.id
         join public.recipe_items ri on ri.menu_id = si.menu_id
         where ri.ingredient_id = i.id
           and s.user_id = v_user_id
           and s.sold_at >= current_date - interval '30 days'
         group by s.sold_at
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
  '재고 예측 raw 데이터 반환. 리드타임 일수와 출처(거래처명/기본값)까지 포함하며, 분류(status/trend)는 클라이언트 src/lib/domain/forecast.ts가 담당.';
