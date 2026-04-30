-- Migration: save_vendor + save_ingredient RPCs (인라인 quick-create 흐름)
-- Spec: T109, T110 (PurchaseForm의 인라인 추가 흐름)
--
-- @supabase/ssr 0.5의 createBrowserClient typing이 INSERT 추론을 못 잡아
-- 클라이언트가 user_id를 직접 다루지 않게 RPC로 위임 (save_menu 패턴과 동일).

create or replace function public.save_vendor(p_name text, p_lead_time_days integer default 1)
returns table (id uuid, name text, lead_time_days integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_vendor_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_lead_time_days < 0 then
    raise exception 'invalid_input: lead_time_days must be >= 0' using errcode = '22023';
  end if;

  insert into public.vendors (user_id, name, lead_time_days)
  values (v_user_id, p_name, p_lead_time_days)
  returning id into v_vendor_id;

  return query
  select v.id, v.name, v.lead_time_days
  from public.vendors v
  where v.id = v_vendor_id;
end;
$$;

comment on function public.save_vendor(text, integer) is
  '거래처 신규 등록. user_id는 auth.uid() 자동.';

revoke all on function public.save_vendor(text, integer) from public;
grant execute on function public.save_vendor(text, integer) to authenticated;

-- ─── save_ingredient ────────────────────────────────────────────
create or replace function public.save_ingredient(
  p_name text,
  p_unit public.ingredient_unit
)
returns table (id uuid, name text, unit public.ingredient_unit, current_avg_price numeric)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_ingredient_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.ingredients (user_id, name, unit)
  values (v_user_id, p_name, p_unit)
  returning id into v_ingredient_id;

  return query
  select i.id, i.name, i.unit, i.current_avg_price
  from public.ingredients i
  where i.id = v_ingredient_id;
end;
$$;

comment on function public.save_ingredient(text, public.ingredient_unit) is
  '재료 신규 등록 (인라인 quick-create). user_id는 auth.uid() 자동.';

revoke all on function public.save_ingredient(text, public.ingredient_unit) from public;
grant execute on function public.save_ingredient(text, public.ingredient_unit) to authenticated;
