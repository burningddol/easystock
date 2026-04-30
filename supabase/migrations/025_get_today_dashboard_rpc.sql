-- Migration: get_today_dashboard RPC (Phase 7 / T146)
-- Spec: FR-019/020/091, contracts/domain-rpc.md, patterns.md "홈 (오늘)"
-- 헌법 III: 메뉴 마진은 sale_items.unit_price - menu_cost_snapshot (스냅샷, 영구 불변)
-- 헌법 IV: security definer + auth.uid() 격리

create or replace function public.get_today_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_yesterday date := v_today - 1;
  v_last_week_yesterday date := v_yesterday - 7;
  v_week_start date := v_yesterday - 6;
  v_store_name text;
  v_y_revenue numeric := 0;
  v_y_cost numeric := 0;
  v_lw_revenue numeric := 0;
  v_change_pct numeric;
  v_missing_yesterday boolean;
  v_weekly_chart jsonb;
  v_expiry_alerts jsonb;
  v_top3 jsonb;
  v_low_id uuid;
  v_low_name text;
  v_low_margin_pct numeric;
  v_low_margin jsonb;
  v_cause_text text;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select store_name into v_store_name
  from public.users
  where id = v_user_id;

  -- 어제 매출 + 원가. plpgsql SELECT INTO는 0 row 시 declared default를 NULL로 덮어쓰므로
  -- 이후 coalesce로 다시 0 할당 (NULL 산술 방지).
  select total_revenue, total_cost_snapshot
    into v_y_revenue, v_y_cost
    from public.sales
   where user_id = v_user_id and sold_at = v_yesterday;

  v_missing_yesterday := not found;
  v_y_revenue := coalesce(v_y_revenue, 0);
  v_y_cost := coalesce(v_y_cost, 0);

  -- 지난주 같은 요일 매출 (FR-020)
  select total_revenue
    into v_lw_revenue
    from public.sales
   where user_id = v_user_id and sold_at = v_last_week_yesterday;

  v_lw_revenue := coalesce(v_lw_revenue, 0);

  if v_lw_revenue > 0 then
    v_change_pct := round((v_y_revenue - v_lw_revenue) / v_lw_revenue * 100, 1);
  end if;

  -- 지난 7일 일별 매출 (어제까지). generate_series 결과를 select에서 ::date로 캐스팅 —
  -- 인터벌 시리즈를 left join 키로 직접 쓰면 timestamp 비교가 발생해 left join이 어긋난다.
  with day_series as (
    select g::date as d
    from generate_series(v_week_start, v_yesterday, '1 day'::interval) g
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'sold_at', day_series.d,
      'revenue', coalesce(s.total_revenue, 0)
    )
    order by day_series.d asc
  ), '[]'::jsonb)
    into v_weekly_chart
    from day_series
    left join public.sales s
      on s.user_id = v_user_id and s.sold_at = day_series.d;

  -- 유통기한 임박 (오늘 ~ +3일)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'ingredient_id', id,
      'name', name,
      'expiry_date', expiry_date,
      'days_until_expiry', (expiry_date - v_today)
    )
    order by expiry_date asc
  ), '[]'::jsonb)
    into v_expiry_alerts
    from public.ingredients
   where user_id = v_user_id
     and is_active = true
     and expiry_date is not null
     and expiry_date >= v_today
     and expiry_date <= v_today + 3;

  -- 이번 주 (지난 7일) 메뉴별 마진 집계 → top3 + 마진 하락 메뉴 1개를 단일 CTE로 한번만 산출.
  -- order by에 menu_id 보조 키 추가 → 동률 시 결정적 순서 보장.
  with menu_aggs as (
    select
      m.id as menu_id,
      m.name,
      sum(si.quantity)::int as units_sold,
      sum(si.unit_price * si.quantity) as revenue,
      sum((si.unit_price - si.menu_cost_snapshot) * si.quantity) as net_profit
    from public.menus m
    join public.sale_items si on si.menu_id = m.id and si.user_id = v_user_id
    join public.sales s on s.id = si.sale_id and s.user_id = v_user_id
    where m.user_id = v_user_id
      and s.sold_at between v_week_start and v_yesterday
    group by m.id, m.name
    having sum(si.unit_price * si.quantity) > 0
  ),
  ranked as (
    select menu_id, name, units_sold, revenue, net_profit,
           net_profit / revenue as margin_ratio
    from menu_aggs
  ),
  top3_rows as (
    select * from ranked
    order by margin_ratio desc, menu_id asc
    limit 3
  ),
  low_row as (
    select * from ranked
    where margin_ratio < 0.30
    order by margin_ratio asc, menu_id asc
    limit 1
  )
  select
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'menu_id', menu_id,
        'name', name,
        'units_sold', units_sold,
        'revenue', revenue,
        'net_profit', net_profit,
        'margin_percent', round(margin_ratio * 100, 1)
      ) order by margin_ratio desc, menu_id asc)
      from top3_rows
    ), '[]'::jsonb),
    (select menu_id from low_row),
    (select name from low_row),
    (select round(margin_ratio * 100, 1) from low_row)
    into v_top3, v_low_id, v_low_name, v_low_margin_pct;

  if v_low_id is not null then
    -- 원인 추정: 해당 메뉴 레시피 재료 중 최근 14일 단가 인상폭 가장 큰 재료
    select i.name || ' 단가 ' ||
           round((ph.new_avg_price - ph.previous_avg_price) / ph.previous_avg_price * 100)::text ||
           '% 인상 영향'
      into v_cause_text
      from public.ingredient_price_history ph
      join public.ingredients i on i.id = ph.ingredient_id
      join public.recipe_items r on r.ingredient_id = ph.ingredient_id and r.menu_id = v_low_id
     where ph.user_id = v_user_id
       and ph.reason = 'purchase'
       and ph.changed_at >= now() - interval '14 days'
       and ph.new_avg_price > ph.previous_avg_price
       and ph.previous_avg_price > 0
     order by (ph.new_avg_price - ph.previous_avg_price) / ph.previous_avg_price desc
     limit 1;

    v_low_margin := jsonb_build_object(
      'menu_id', v_low_id,
      'name', v_low_name,
      'margin_percent', v_low_margin_pct,
      'cause', v_cause_text
    );
  end if;

  return jsonb_build_object(
    'store_name', v_store_name,
    'yesterday', jsonb_build_object(
      'sold_at', v_yesterday,
      'revenue', v_y_revenue,
      'net_profit', v_y_revenue - v_y_cost,
      'margin_percent',
        case when v_y_revenue > 0
          then round((v_y_revenue - v_y_cost) / v_y_revenue * 100, 1)
          else 0
        end,
      'last_week_revenue', v_lw_revenue,
      'revenue_change_percent', v_change_pct
    ),
    'weekly_chart', v_weekly_chart,
    'expiry_alerts', v_expiry_alerts,
    'missing_yesterday_sale', v_missing_yesterday,
    'top3_menus', v_top3,
    'low_margin_menu', v_low_margin
  );
end;
$$;

grant execute on function public.get_today_dashboard() to authenticated;

comment on function public.get_today_dashboard() is
  '오늘 대시보드 (FR-019/020/091): 어제 KPI + 지난주 같은 요일 비교 + 7일 차트 + 유통기한 알림 + 이번 주 TOP3 메뉴 마진 + 마진 하락 메뉴 1개. 발주 알림(소진 예측)은 get_depletion_forecast()로 별도 호출. 헌법 III: sale_items.menu_cost_snapshot/unit_price 스냅샷만 사용 — 과거 마진 영구 불변.';
