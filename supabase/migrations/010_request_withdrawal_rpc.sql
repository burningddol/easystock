-- Migration: 탈퇴 신청 RPC
-- Spec: contracts/auth.md Withdrawal, FR-034~037
-- 호출자: 인증된 사용자가 본인 계정 탈퇴 (Settings 페이지)

create or replace function public.request_withdrawal()
returns table (success boolean, permanent_delete_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_delete_at timestamptz := v_now + interval '30 days';
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.users
  set withdrawal_requested_at = v_now,
      permanent_delete_at = v_delete_at,
      updated_at = v_now
  where id = v_user_id
    and withdrawal_requested_at is null;

  if not found then
    raise exception 'withdrawal already requested or user not found'
      using errcode = '02000';
  end if;

  return query select true, v_delete_at;
end;
$$;

comment on function public.request_withdrawal() is
  '탈퇴 신청 (FR-034). withdrawal_requested_at = now(), permanent_delete_at = +30일. Edge Function `permanent-delete`가 만료 사용자 cascade 삭제.';

revoke all on function public.request_withdrawal() from public;
grant execute on function public.request_withdrawal() to authenticated;
