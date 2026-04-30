-- Migration: save_purchase RPC (트랜잭셔널 매입 + 가중 이동 평균법)
-- Spec: contracts/domain-rpc.md L15-55, FR-004/005/029
-- 헌법 III (NON-NEGOTIABLE): 가중 이동 평균법으로 current_avg_price 갱신
-- 클라이언트 미리보기는 src/lib/domain/pricing.ts (computeNewWeightedAverage) — 같은 공식.
--
-- 입력: { vendor_id, purchased_at, items: [{ ingredient_id, quantity, amount }] }
-- 출력: {
--   purchase_order_id,
--   price_change_alerts: [{ ingredient_id, ingredient_name, previous_avg_price,
--                           new_avg_price, change_percent }]  -- ±5% 이상만
-- }
--
-- 트랜잭션:
--   1) 활성 vendor + 본인 소유 검증
--   2) purchase_orders 헤더 INSERT
--   3) 각 item:
--      a) 활성 ingredient + 본인 소유 검증
--      b) purchase_order_items INSERT (unit_price는 generated)
--      c) 가중 이동 평균: new_avg = (stock × avg + qty × unit_price) / (stock + qty)
--         (stock=0이면 new_avg = unit_price, FR-004)
--      d) ingredients.current_avg_price + current_stock 갱신
--      e) ingredient_price_history INSERT (reason='purchase')
--      f) |change_percent| >= 5이면 price_change_alerts에 추가
--   4) purchase_orders.total_amount = Σ items.amount

create or replace function public.save_purchase(
  p_vendor_id uuid,
  p_purchased_at date,
  p_items jsonb
)
returns table (
  purchase_order_id uuid,
  price_change_alerts jsonb
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_vendor record;
  v_order_id uuid;
  v_total_amount numeric(14, 2) := 0;
  v_item jsonb;
  v_ingredient record;
  v_quantity numeric(12, 3);
  v_amount numeric(14, 2);
  v_unit_price numeric(12, 4);
  v_prev_avg numeric(12, 4);
  v_prev_stock numeric(12, 3);
  v_new_avg numeric(12, 4);
  v_new_stock numeric(12, 3);
  v_change_percent numeric(8, 2);
  v_alerts jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_input: items must be non-empty array' using errcode = '22023';
  end if;

  select v.id, v.is_active
  into v_vendor
  from public.vendors v
  where v.id = p_vendor_id and v.user_id = v_user_id;

  if not found then
    raise exception 'vendor_not_found' using errcode = '22023';
  end if;

  if not v_vendor.is_active then
    raise exception 'vendor_inactive' using errcode = '22023';
  end if;

  insert into public.purchase_orders (user_id, vendor_id, purchased_at)
  values (v_user_id, p_vendor_id, p_purchased_at)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_amount := (v_item ->> 'amount')::numeric;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'invalid_input: quantity must be positive' using errcode = '22023';
    end if;
    if v_amount is null or v_amount < 0 then
      raise exception 'invalid_input: amount must be non-negative' using errcode = '22023';
    end if;

    select i.id, i.name, i.is_active, i.current_stock, i.current_avg_price
    into v_ingredient
    from public.ingredients i
    where i.id = (v_item ->> 'ingredient_id')::uuid and i.user_id = v_user_id;

    if not found then
      raise exception 'ingredient_not_found' using errcode = '22023';
    end if;

    if not v_ingredient.is_active then
      raise exception 'ingredient_inactive: %', v_ingredient.name using errcode = '22023';
    end if;

    v_unit_price := v_amount / v_quantity;
    v_prev_avg := v_ingredient.current_avg_price;
    v_prev_stock := v_ingredient.current_stock;

    -- 가중 이동 평균법 (헌법 III, FR-004)
    if v_prev_stock = 0 then
      v_new_avg := v_unit_price;
    else
      v_new_avg := (v_prev_stock * v_prev_avg + v_quantity * v_unit_price)
                   / (v_prev_stock + v_quantity);
    end if;
    v_new_stock := v_prev_stock + v_quantity;

    insert into public.purchase_order_items (
      purchase_order_id, user_id, ingredient_id, quantity, amount
    ) values (
      v_order_id, v_user_id, v_ingredient.id, v_quantity, v_amount
    );

    update public.ingredients
    set current_avg_price = v_new_avg,
        current_stock = v_new_stock,
        updated_at = now()
    where id = v_ingredient.id;

    insert into public.ingredient_price_history (
      user_id, ingredient_id, previous_avg_price, new_avg_price,
      previous_stock, new_stock, reason, reference_id
    ) values (
      v_user_id, v_ingredient.id, v_prev_avg, v_new_avg,
      v_prev_stock, v_new_stock,
      'purchase', v_order_id
    );

    -- ±5% 변동 알림 (FR-005). 첫 매입(prev=0)은 비교 의미 없으므로 제외.
    if v_prev_avg > 0 then
      v_change_percent := round(((v_new_avg - v_prev_avg) / v_prev_avg) * 100, 2);
      if abs(v_change_percent) >= 5 then
        v_alerts := v_alerts || jsonb_build_object(
          'ingredient_id', v_ingredient.id,
          'ingredient_name', v_ingredient.name,
          'previous_avg_price', v_prev_avg,
          'new_avg_price', v_new_avg,
          'change_percent', v_change_percent
        );
      end if;
    end if;

    v_total_amount := v_total_amount + v_amount;
  end loop;

  update public.purchase_orders
  set total_amount = v_total_amount
  where id = v_order_id;

  return query select v_order_id, v_alerts;
end;
$$;

comment on function public.save_purchase(uuid, date, jsonb) is
  '매입 트랜잭셔널 저장 + 가중 이동 평균법 단가 갱신 (FR-004) + ±5% 변동 알림 (FR-005). 헌법 III.';

revoke all on function public.save_purchase(uuid, date, jsonb) from public;
grant execute on function public.save_purchase(uuid, date, jsonb) to authenticated;
