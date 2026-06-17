-- Migration: menu demand forecast raw samples
--
-- Returns per-menu daily sales quantity samples. The client-side forecast
-- domain module owns the prediction model so inventory and menu demand use
-- one algorithmic source.

create or replace function public.get_menu_demand_forecast()
returns table (
  menu_id uuid,
  name text,
  price numeric,
  is_active boolean,
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
  select
    m.id,
    m.name,
    m.price,
    m.is_active,
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
  '메뉴별 수요 예측 raw 데이터 반환. 최근 90일 일별 판매 수량 sample을 반환하며 최종 예측은 src/lib/domain/forecast.ts가 담당.';

revoke all on function public.get_menu_demand_forecast() from public;
grant execute on function public.get_menu_demand_forecast() to authenticated;
