-- Migration: apply_stock_count RPC (재고 실사 적용)
-- Spec: contracts/domain-rpc.md L177-213, FR-015/016/017/028
-- 헌법 III: 단가 불변 (FR-016) — current_avg_price는 절대 변경 안 함

create or replace function public.apply_stock_count(
  p_counted_at date,
  p_items jsonb
)
returns table (
  stock_count_id uuid,
  weekly_loss_amount numeric,
  item_differences jsonb
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_count_id uuid;
  v_total_loss numeric(14, 4) := 0;
  v_item jsonb;
  v_ingredient record;
  v_actual numeric(12, 3);
  v_diff numeric(14, 3);
  v_loss numeric(14, 4);
  v_diffs jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_input: items must be non-empty array' using errcode = '22023';
  end if;

  insert into public.daily_stock_counts (user_id, counted_at)
  values (v_user_id, p_counted_at)
  returning id into v_count_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_actual := (v_item ->> 'actual_stock')::numeric;
    if v_actual is null or v_actual < 0 then
      raise exception 'invalid_input: actual_stock must be >= 0' using errcode = '22023';
    end if;

    select i.id, i.name, i.current_stock, i.current_avg_price
    into v_ingredient
    from public.ingredients i
    where i.id = (v_item ->> 'ingredient_id')::uuid and i.user_id = v_user_id;

    if not found then
      raise exception 'ingredient_not_found' using errcode = '22023';
    end if;

    -- 차이 = system - actual. 양수면 손실, 음수면 발견(over).
    v_diff := v_ingredient.current_stock - v_actual;
    v_loss := v_diff * v_ingredient.current_avg_price;

    -- stock_count_items 명세 INSERT (system_stock_at_count = 실사 시점 스냅샷)
    insert into public.stock_count_items (
      stock_count_id, user_id, ingredient_id,
      actual_stock, system_stock_at_count, weekly_loss_amount
    ) values (
      v_count_id, v_user_id, v_ingredient.id,
      v_actual, v_ingredient.current_stock, v_loss
    );

    -- ingredients.current_stock = actual (단가는 그대로!)
    update public.ingredients
    set current_stock = v_actual,
        updated_at = now()
    where id = v_ingredient.id;

    -- price_history (reason='stock_count_correction', new_avg = previous_avg)
    insert into public.ingredient_price_history (
      user_id, ingredient_id, previous_avg_price, new_avg_price,
      previous_stock, new_stock, reason, reference_id
    ) values (
      v_user_id, v_ingredient.id,
      v_ingredient.current_avg_price, v_ingredient.current_avg_price,
      v_ingredient.current_stock, v_actual,
      'stock_count_correction', v_count_id
    );

    v_total_loss := v_total_loss + v_loss;
    v_diffs := v_diffs || jsonb_build_object(
      'ingredient_id', v_ingredient.id,
      'name', v_ingredient.name,
      'system_stock', v_ingredient.current_stock,
      'actual_stock', v_actual,
      'diff', v_diff,
      'loss_amount', v_loss
    );
  end loop;

  return query select v_count_id, v_total_loss, v_diffs;
end;
$$;

comment on function public.apply_stock_count(date, jsonb) is
  '재고 실사 적용 (FR-015). 수량만 보정, 단가 불변 (FR-016, 헌법 III). 손실액 합계 반환.';

revoke all on function public.apply_stock_count(date, jsonb) from public;
grant execute on function public.apply_stock_count(date, jsonb) to authenticated;
