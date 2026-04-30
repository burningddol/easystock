-- Migration: save_menu RPC (메뉴 + 레시피 트랜잭셔널 저장)
-- 호출자: 인증된 사용자가 신규 메뉴 등록 (편집은 후속 PR)
--
-- 한 트랜잭션으로 menu INSERT + recipe_items INSERT를 묶어
-- 클라이언트가 user_id를 직접 다루지 않게 한다 (auth.uid()로 자동 채움).

create or replace function public.save_menu(
  p_name text,
  p_price numeric,
  p_recipe jsonb default '[]'::jsonb
)
returns table (menu_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_menu_id uuid;
  v_item jsonb;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_recipe) <> 'array' then
    raise exception 'recipe must be a JSONB array' using errcode = '22023';
  end if;

  insert into public.menus (user_id, name, price)
  values (v_user_id, p_name, p_price)
  returning id into v_menu_id;

  for v_item in select * from jsonb_array_elements(p_recipe)
  loop
    insert into public.recipe_items (menu_id, user_id, ingredient_id, quantity_per_serving)
    values (
      v_menu_id,
      v_user_id,
      (v_item ->> 'ingredient_id')::uuid,
      (v_item ->> 'quantity_per_serving')::numeric
    );
  end loop;

  return query select v_menu_id;
end;
$$;

comment on function public.save_menu(text, numeric, jsonb) is
  '메뉴 + 레시피 트랜잭셔널 저장. recipe = [{"ingredient_id": uuid, "quantity_per_serving": numeric}, ...]. user_id는 auth.uid()로 자동.';

revoke all on function public.save_menu(text, numeric, jsonb) from public;
grant execute on function public.save_menu(text, numeric, jsonb) to authenticated;
