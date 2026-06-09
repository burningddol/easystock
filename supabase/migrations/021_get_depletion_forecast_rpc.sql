-- Migration: get_depletion_forecast RPC (재고 예측 raw 데이터)
-- Spec: contracts/domain-rpc.md L215-241
--
-- 분류 자체는 클라이언트 forecast.ts가 담당. 서버는 ingredient + 30일 sale 소비
-- 샘플 + lead_time(첫 거래처 또는 기본 1일) + safety_buffer_days + signed_up_at
-- + regular_days_off만 반환.
-- "raw 데이터 + 클라이언트 분류" 결정 (tasks.md T124의 latter 방식): 테스트 단순화 +
-- 클라이언트가 forecast.ts 그대로 재사용.

create or replace function public.get_depletion_forecast()
returns table (
  ingredient_id uuid,
  name text,
  unit public.ingredient_unit,
  current_stock numeric,
  lead_time_days integer,
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
  select
    i.id,
    i.name,
    i.unit,
    i.current_stock,
    -- lead_time: 가장 자주 사용한 vendor의 leadTime, 없으면 기본 1일
    coalesce(
      (select v.lead_time_days
       from public.purchase_orders po
       join public.vendors v on v.id = po.vendor_id
       join public.purchase_order_items poi on poi.purchase_order_id = po.id
       where poi.ingredient_id = i.id and po.user_id = v_user_id
       group by v.lead_time_days
       order by count(*) desc
       limit 1),
      1
    ) as lead_time_days,
    u.safety_buffer_days,
    -- 30일치 일별 소비량: sale_items.quantity × recipe_items.quantity_per_serving 합산
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
  where i.user_id = v_user_id and i.is_active = true
  order by i.name;
end;
$$;

comment on function public.get_depletion_forecast() is
  '재고 예측 raw 데이터 반환. 분류(status/trend)는 클라이언트 src/lib/domain/forecast.ts가 담당.';

revoke all on function public.get_depletion_forecast() from public;
grant execute on function public.get_depletion_forecast() to authenticated;
