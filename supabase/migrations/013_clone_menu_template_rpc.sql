-- Migration: clone_menu_template RPC
-- Spec: contracts/domain-rpc.md L146-164, FR-003
-- 호출자: 인증된 사용자가 store_type 템플릿을 본인 가게에 복제

create or replace function public.clone_menu_template(p_store_type public.store_type)
returns table (menu_ids uuid[], ingredient_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_template record;
  v_recipe_item jsonb;
  v_ingredient_id uuid;
  v_menu_id uuid;
  v_menu_ids uuid[] := '{}';
  v_ingredient_ids uuid[] := '{}';
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  for v_template in
    select id, name, price, recipe
    from public.menu_templates
    where store_type = p_store_type
    order by name
  loop
    -- 1) 메뉴 INSERT (이름 충돌 시 skip — 기존 메뉴 ID 재활용)
    insert into public.menus (user_id, name, price)
    values (v_user_id, v_template.name, v_template.price)
    on conflict (user_id, name) do nothing
    returning id into v_menu_id;

    if v_menu_id is null then
      select id into v_menu_id
      from public.menus
      where user_id = v_user_id and name = v_template.name;
    else
      v_menu_ids := array_append(v_menu_ids, v_menu_id);
    end if;

    -- 2) 레시피 항목별 재료 + recipe_item 생성
    for v_recipe_item in select * from jsonb_array_elements(v_template.recipe)
    loop
      -- 재료 INSERT (이름 충돌 시 skip — 기존 재료 ID 재활용)
      insert into public.ingredients (user_id, name, unit)
      values (
        v_user_id,
        v_recipe_item ->> 'ingredient_name',
        (v_recipe_item ->> 'unit')::public.ingredient_unit
      )
      on conflict (user_id, name) do nothing
      returning id into v_ingredient_id;

      if v_ingredient_id is null then
        select id into v_ingredient_id
        from public.ingredients
        where user_id = v_user_id and name = v_recipe_item ->> 'ingredient_name';
      else
        v_ingredient_ids := array_append(v_ingredient_ids, v_ingredient_id);
      end if;

      -- recipe_item INSERT (이미 있으면 skip — 메뉴가 이전에 만들어졌을 수 있음)
      insert into public.recipe_items (menu_id, user_id, ingredient_id, quantity_per_serving)
      values (
        v_menu_id,
        v_user_id,
        v_ingredient_id,
        (v_recipe_item ->> 'quantity')::numeric
      )
      on conflict (menu_id, ingredient_id) do nothing;
    end loop;
  end loop;

  return query select v_menu_ids, v_ingredient_ids;
end;
$$;

comment on function public.clone_menu_template(public.store_type) is
  '메뉴 템플릿을 사용자 가게에 복제 (FR-003). 메뉴/재료 이름 충돌 시 skip — 기존 데이터 보존. 반환: 새로 생성된 menu_ids / ingredient_ids.';

revoke all on function public.clone_menu_template(public.store_type) from public;
grant execute on function public.clone_menu_template(public.store_type) to authenticated;
