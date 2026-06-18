-- Migration: 발주 추천 이력 리포트 RPC
-- 최근 추천 스냅샷과 매입 전환 여부를 화면용 JSON으로 반환.

create or replace function public.get_order_recommendation_report(p_limit integer default 30)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 100));
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  with recent_snapshots as (
    select
      s.id,
      s.vendor_id,
      v.name as vendor_name,
      s.source,
      s.purchase_order_id,
      po.purchased_at,
      s.created_at
    from public.order_recommendation_snapshots s
    left join public.vendors v
      on v.id = s.vendor_id
     and v.user_id = v_user_id
    left join public.purchase_orders po
      on po.id = s.purchase_order_id
     and po.user_id = v_user_id
    where s.user_id = v_user_id
    order by s.created_at desc
    limit v_limit
  ),
  snapshot_rows as (
    select
      s.id,
      s.vendor_id,
      s.vendor_name,
      s.source,
      s.purchase_order_id,
      s.purchased_at,
      s.created_at,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'ingredient_id', i.id,
            'ingredient_name', i.name,
            'unit', i.unit,
            'recommended_quantity', si.recommended_quantity,
            'current_stock', si.current_stock,
            'expected_depletion_date', si.expected_depletion_date,
            'order_by_date', si.order_by_date,
            'lead_time_days', si.lead_time_days,
            'safety_buffer_days', si.safety_buffer_days,
            'purchase_coverage_days', si.purchase_coverage_days
          )
          order by i.name
        ) filter (where si.id is not null),
        '[]'::jsonb
      ) as items
    from recent_snapshots s
    left join public.order_recommendation_snapshot_items si
      on si.snapshot_id = s.id
     and si.user_id = v_user_id
    left join public.ingredients i
      on i.id = si.ingredient_id
     and i.user_id = v_user_id
    group by
      s.id,
      s.vendor_id,
      s.vendor_name,
      s.source,
      s.purchase_order_id,
      s.purchased_at,
      s.created_at
  ),
  summary as (
    select
      count(*)::integer as snapshot_count,
      count(*) filter (where purchase_order_id is not null)::integer as converted_count,
      count(*) filter (where purchase_order_id is null)::integer as pending_count
    from snapshot_rows
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'snapshot_count', summary.snapshot_count,
      'converted_count', summary.converted_count,
      'pending_count', summary.pending_count
    ),
    'snapshots', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'snapshot_id', sr.id,
          'vendor_id', sr.vendor_id,
          'vendor_name', sr.vendor_name,
          'source', sr.source,
          'purchase_order_id', sr.purchase_order_id,
          'purchased_at', sr.purchased_at,
          'created_at', sr.created_at,
          'items', sr.items
        )
        order by sr.created_at desc
      ) filter (where sr.id is not null),
      '[]'::jsonb
    )
  )
  into v_result
  from summary
  left join snapshot_rows sr on true
  group by summary.snapshot_count, summary.converted_count, summary.pending_count;

  return coalesce(
    v_result,
    jsonb_build_object(
      'summary', jsonb_build_object(
        'snapshot_count', 0,
        'converted_count', 0,
        'pending_count', 0
      ),
      'snapshots', '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_order_recommendation_report(integer) from public;
grant execute on function public.get_order_recommendation_report(integer) to authenticated;
