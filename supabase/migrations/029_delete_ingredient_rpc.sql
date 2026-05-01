-- Migration: delete_ingredient RPC (soft delete)
-- 호출자: 인증된 사용자가 본인 소유 재료를 비활성화.
--
-- Soft delete (is_active=false) 이유:
--  - recipe_items.ingredient_id → ingredients.id on delete restrict
--  - ingredient_price_history.ingredient_id → on delete cascade (이력은 cascade 무관)
--  - 사용 중인 메뉴가 있으면 hard delete는 거부됨 + 통계/단가 history 보존이 안전
--
-- 사용 중인 메뉴가 있으면 응답에 menu_count 포함 → UI가 안내 후 비활성만 진행.

create or replace function public.delete_ingredient(p_ingredient_id uuid)
returns table (
  ingredient_id uuid,
  was_active boolean,
  in_use_menu_count integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_was_active boolean;
  v_menu_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select is_active into v_was_active
  from public.ingredients
  where id = p_ingredient_id and user_id = v_user_id;

  if v_was_active is null then
    raise exception 'ingredient_not_found_or_forbidden' using errcode = '42501';
  end if;

  -- 이 재료를 레시피에 쓰는 활성 메뉴 수 (UI 안내용)
  select count(distinct ri.menu_id)::int
  into v_menu_count
  from public.recipe_items ri
  join public.menus m on m.id = ri.menu_id
  where ri.ingredient_id = p_ingredient_id
    and ri.user_id = v_user_id
    and m.is_active = true;

  update public.ingredients
  set is_active = false
  where id = p_ingredient_id and user_id = v_user_id;

  return query
  select p_ingredient_id, v_was_active, v_menu_count;
end;
$$;

comment on function public.delete_ingredient(uuid) is
  '재료 soft delete (is_active=false). 사용 중인 메뉴 수 in_use_menu_count로 반환 → UI가 경고 후 비활성. 단가 history + 과거 sale 참조 보존.';

revoke all on function public.delete_ingredient(uuid) from public;
grant execute on function public.delete_ingredient(uuid) to authenticated;
