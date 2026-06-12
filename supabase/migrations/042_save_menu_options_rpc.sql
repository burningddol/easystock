-- Migration: menu option management RPC

create or replace function public.save_menu_options(
  p_menu_id uuid,
  p_option_groups jsonb
)
returns table (
  menu_id uuid,
  option_group_count integer,
  option_value_count integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_group jsonb;
  v_value jsonb;
  v_recipe jsonb;
  v_group_id uuid;
  v_value_id uuid;
  v_group_count integer := 0;
  v_value_count integer := 0;
  v_existing_group record;
  v_existing_value record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_option_groups is null then
    p_option_groups := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_option_groups) <> 'array' then
    raise exception 'invalid_input: option_groups must be array' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.menus m where m.id = p_menu_id and m.user_id = v_user_id
  ) then
    raise exception 'menu_not_found' using errcode = '22023';
  end if;

  -- Past sale snapshots may reference old option rows, so deactivate instead of deleting.
  update public.menu_option_groups
  set is_active = false
  where menu_id = p_menu_id
    and user_id = v_user_id;

  update public.menu_option_values ov
  set is_active = false
  from public.menu_option_groups og
  where ov.option_group_id = og.id
    and og.menu_id = p_menu_id
    and ov.user_id = v_user_id;

  for v_group in select * from jsonb_array_elements(p_option_groups)
  loop
    if nullif(btrim(v_group ->> 'name'), '') is null then
      raise exception 'invalid_input: option group name is required' using errcode = '22023';
    end if;

    select *
    into v_existing_group
    from public.menu_option_groups
    where menu_id = p_menu_id
      and user_id = v_user_id
      and name = btrim(v_group ->> 'name')
    limit 1;

    if found then
      update public.menu_option_groups
      set selection_type = coalesce(nullif(v_group ->> 'selection_type', ''), selection_type),
          is_required = coalesce((v_group ->> 'is_required')::boolean, is_required),
          min_select = coalesce((v_group ->> 'min_select')::integer, min_select),
          max_select = nullif(v_group ->> 'max_select', '')::integer,
          sort_order = coalesce((v_group ->> 'sort_order')::integer, sort_order),
          is_active = true
      where id = v_existing_group.id
      returning id into v_group_id;
    else
      insert into public.menu_option_groups (
        user_id,
        menu_id,
        name,
        selection_type,
        is_required,
        min_select,
        max_select,
        sort_order,
        is_active
      ) values (
        v_user_id,
        p_menu_id,
        btrim(v_group ->> 'name'),
        coalesce(nullif(v_group ->> 'selection_type', ''), 'add_on'),
        coalesce((v_group ->> 'is_required')::boolean, false),
        coalesce((v_group ->> 'min_select')::integer, 0),
        nullif(v_group ->> 'max_select', '')::integer,
        coalesce((v_group ->> 'sort_order')::integer, v_group_count),
        true
      )
      returning id into v_group_id;
    end if;

    v_group_count := v_group_count + 1;

    for v_value in select * from jsonb_array_elements(coalesce(v_group -> 'values', '[]'::jsonb))
    loop
      if nullif(btrim(v_value ->> 'name'), '') is null then
        raise exception 'invalid_input: option value name is required' using errcode = '22023';
      end if;

      select *
      into v_existing_value
      from public.menu_option_values
      where option_group_id = v_group_id
        and user_id = v_user_id
        and name = btrim(v_value ->> 'name')
      limit 1;

      if found then
        update public.menu_option_values
        set price_delta = coalesce((v_value ->> 'price_delta')::numeric, price_delta),
            is_default = coalesce((v_value ->> 'is_default')::boolean, is_default),
            sort_order = coalesce((v_value ->> 'sort_order')::integer, sort_order),
            is_active = true
        where id = v_existing_value.id
        returning id into v_value_id;
      else
        insert into public.menu_option_values (
          user_id,
          option_group_id,
          name,
          price_delta,
          is_default,
          sort_order,
          is_active
        ) values (
          v_user_id,
          v_group_id,
          btrim(v_value ->> 'name'),
          coalesce((v_value ->> 'price_delta')::numeric, 0),
          coalesce((v_value ->> 'is_default')::boolean, false),
          coalesce((v_value ->> 'sort_order')::integer, v_value_count),
          true
        )
        returning id into v_value_id;
      end if;

      v_value_count := v_value_count + 1;

      delete from public.menu_option_value_recipe_items
      where option_value_id = v_value_id
        and user_id = v_user_id;

      for v_recipe in select * from jsonb_array_elements(coalesce(v_value -> 'recipe', '[]'::jsonb))
      loop
        insert into public.menu_option_value_recipe_items (
          user_id,
          option_value_id,
          ingredient_id,
          quantity_per_selection
        ) values (
          v_user_id,
          v_value_id,
          (v_recipe ->> 'ingredient_id')::uuid,
          (v_recipe ->> 'quantity_per_selection')::numeric
        );
      end loop;
    end loop;
  end loop;

  return query select p_menu_id, v_group_count, v_value_count;
end;
$$;

comment on function public.save_menu_options(uuid, jsonb) is
  'Replaces active menu option groups/values/recipes for a menu. Old rows are deactivated for sale snapshot compatibility.';

revoke all on function public.save_menu_options(uuid, jsonb) from public;
grant execute on function public.save_menu_options(uuid, jsonb) to authenticated;
