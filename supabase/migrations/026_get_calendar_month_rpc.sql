-- Migration: get_calendar_month RPC (Phase 8 / T155)
-- Spec: contracts/domain-rpc.md "Calendar", FR-021~024, FR-043, FR-045
-- 헌법 III: sales 스냅샷 (total_revenue / total_cost_snapshot)만 사용
-- 헌법 IV: security definer + auth.uid() 격리
-- consecutive_missing_days는 클라이언트에서 계산 (raw data + flag만 반환)

create or replace function public.get_calendar_month(p_year int, p_month int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_month_start date;
  v_month_end date;
  v_signed_up date;
  v_days_off public.weekday[];
  v_total_revenue numeric := 0;
  v_total_net_profit numeric := 0;
  v_operating_days int := 0;
  v_avg_daily numeric := 0;
  v_cells jsonb;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if p_month < 1 or p_month > 12 then
    raise exception 'invalid_month' using errcode = '22023';
  end if;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;

  select signed_up_at::date, regular_days_off
    into v_signed_up, v_days_off
    from public.users
   where id = v_user_id;

  -- users row 없거나 signed_up_at NULL이면 비교가 NULL이 되어 jsonb에 null로 직렬화 →
  -- TS 측 boolean 타입 위반. fallback으로 월 시작일을 사용 (해당 월은 모두 가입 후로 간주).
  v_signed_up := coalesce(v_signed_up, v_month_start);
  v_days_off := coalesce(v_days_off, '{}');

  -- 월 누적 (영업일 = sale 있는 날, 정기휴무 제외 자연스럽게)
  select
    coalesce(sum(total_revenue), 0),
    coalesce(sum(total_revenue - total_cost_snapshot), 0),
    count(*)
    into v_total_revenue, v_total_net_profit, v_operating_days
    from public.sales
   where user_id = v_user_id
     and sold_at between v_month_start and v_month_end;

  if v_operating_days > 0 then
    v_avg_daily := round(v_total_revenue / v_operating_days, 0);
  end if;

  -- 일별 셀 (28~31일)
  with day_series as (
    select g::date as d
    from generate_series(v_month_start, v_month_end, '1 day'::interval) g
  ),
  daily_purchases as (
    select distinct purchased_at as d
    from public.purchase_orders
    where user_id = v_user_id
      and purchased_at between v_month_start and v_month_end
  ),
  enriched as (
    select
      ds.d,
      (ds.d > v_today) as is_future,
      (ds.d < v_signed_up) as is_before_signup,
      (s.id is not null) as has_sale,
      (p.d is not null) as has_purchase,
      s.total_revenue as revenue,
      case when s.id is not null
           then s.total_revenue - s.total_cost_snapshot
           else null
      end as net_profit,
      -- FR-045: 정기휴무 요일에 sale 있으면 예외 영업 → is_regular_day_off=false.
      -- PG dow: 0=SUN, 1=MON, ... 6=SAT. 한 번만 계산해 is_missing에서 재사용.
      ((case extract(dow from ds.d)::int
          when 0 then 'SUN'::public.weekday
          when 1 then 'MON'::public.weekday
          when 2 then 'TUE'::public.weekday
          when 3 then 'WED'::public.weekday
          when 4 then 'THU'::public.weekday
          when 5 then 'FRI'::public.weekday
          when 6 then 'SAT'::public.weekday
        end) = any(v_days_off)
       and s.id is null) as is_regular_day_off
    from day_series ds
    left join public.sales s
      on s.user_id = v_user_id and s.sold_at = ds.d
    left join daily_purchases p
      on p.d = ds.d
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', e.d,
      'is_future', e.is_future,
      'is_before_signup', e.is_before_signup,
      'is_regular_day_off', e.is_regular_day_off,
      'has_sale', e.has_sale,
      'has_purchase', e.has_purchase,
      -- 누락: 영업가능 + 정기휴무 아님 + sale 없음
      'is_missing', (
        not e.is_future
        and not e.is_before_signup
        and not e.is_regular_day_off
        and not e.has_sale
      ),
      'revenue', e.revenue,
      'net_profit', e.net_profit
    )
    order by e.d asc
  ), '[]'::jsonb)
    into v_cells
    from enriched e;

  return jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'cumulative', jsonb_build_object(
      'total_revenue', v_total_revenue,
      'total_net_profit', v_total_net_profit,
      'avg_daily_revenue', v_avg_daily,
      'operating_days', v_operating_days
    ),
    'cells', v_cells,
    'margin_label', '재료 원가 기준 (이동평균법)'
  );
end;
$$;

grant execute on function public.get_calendar_month(int, int) to authenticated;

comment on function public.get_calendar_month(int, int) is
  '월간 캘린더 (FR-021~024, FR-043, FR-045): 월 누적 KPI + 일별 셀 (영업/누락/정기휴무/매입/매출). consecutive_missing_days는 클라이언트에서 셀 배열 순회로 계산. 헌법 III: sales 스냅샷만 사용. 헌법 IV: auth.uid() 격리.';
