-- Migration: edit_menu + delete_menu RPCs
-- 호출자: 인증된 사용자가 본인 소유 메뉴를 수정/삭제.
--
-- 헌법 III 호환:
--  - 메뉴 가격/원가 변경은 sale_items.unit_price / menu_cost_snapshot에 영향 X
--    (이미 저장된 sale은 스냅샷 기반 — 과거 마진 영구 불변).
--  - 따라서 단순 UPDATE로 충분.
--
-- 삭제는 soft delete (is_active=false). 이유: sale_items.menu_id → menus.id on delete restrict
-- 이라 하드 delete 시 과거 sale이 있는 메뉴는 거부됨. soft delete는 UX 일관 + 통계 보존.

create or replace function public.edit_menu(
  p_menu_id uuid,
  p_name text,
  p_price numeric,
  p_recipe jsonb default '[]'::jsonb
)
returns table (menu_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_owns boolean;
  v_item jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_recipe) <> 'array' then
    raise exception 'recipe must be a JSONB array' using errcode = '22023';
  end if;

  -- 본인 소유 메뉴인지 검증 (RLS도 막지만 명시적 에러 메시지)
  select exists (
    select 1 from public.menus
    where id = p_menu_id and user_id = v_user_id
  ) into v_owns;

  if not v_owns then
    raise exception 'menu_not_found_or_forbidden' using errcode = '42501';
  end if;

  update public.menus
  set name = p_name, price = p_price
  where id = p_menu_id and user_id = v_user_id;

  -- 레시피는 delete + insert (recipe_items 작아서 diff 비용 무의미)
  delete from public.recipe_items where menu_id = p_menu_id;

  for v_item in select * from jsonb_array_elements(p_recipe)
  loop
    insert into public.recipe_items (menu_id, user_id, ingredient_id, quantity_per_serving)
    values (
      p_menu_id,
      v_user_id,
      (v_item ->> 'ingredient_id')::uuid,
      (v_item ->> 'quantity_per_serving')::numeric
    );
  end loop;

  return query select p_menu_id;
end;
$$;

comment on function public.edit_menu(uuid, text, numeric, jsonb) is
  '메뉴 + 레시피 수정 (트랜잭셔널). 과거 sale의 unit_price/menu_cost_snapshot은 스냅샷이라 영향 없음 (헌법 III).';

revoke all on function public.edit_menu(uuid, text, numeric, jsonb) from public;
grant execute on function public.edit_menu(uuid, text, numeric, jsonb) to authenticated;

-- ─── delete_menu (soft delete) ──────────────────────────────────
create or replace function public.delete_menu(p_menu_id uuid)
returns table (menu_id uuid, was_active boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_was_active boolean;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 본인 소유 + 현재 active 상태 회수
  select is_active into v_was_active
  from public.menus
  where id = p_menu_id and user_id = v_user_id;

  if v_was_active is null then
    raise exception 'menu_not_found_or_forbidden' using errcode = '42501';
  end if;

  -- soft delete: 이미 비활성이어도 idempotent
  update public.menus
  set is_active = false
  where id = p_menu_id and user_id = v_user_id;

  return query
  select p_menu_id, v_was_active;
end;
$$;

comment on function public.delete_menu(uuid) is
  '메뉴 soft delete (is_active=false). 과거 sale_items.menu_id 참조 보존 — 통계/매출 history 영구 유지.';

revoke all on function public.delete_menu(uuid) from public;
grant execute on function public.delete_menu(uuid) to authenticated;
