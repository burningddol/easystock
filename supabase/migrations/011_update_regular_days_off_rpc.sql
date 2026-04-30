-- Migration: 정기휴무 요일 갱신 RPC
-- Spec: contracts/domain-rpc.md L246-258, FR-040, FR-044
-- 호출자: 인증된 사용자가 본인 가게 정기휴무 요일 변경 (Settings 페이지)
--
-- FR-044: 변경은 변경 시점 이후부터 적용. 과거 데이터(캘린더, 누락 카운트, 평균 산정)는
-- 그 시점의 규칙을 유지해야 한다. 이 RPC는 현재 값만 갱신하고, 과거 표시는 호출 측에서
-- 변경 이력을 참조해 재현한다 (도메인 함수 `applyChangeSnapshot`).

create or replace function public.update_regular_days_off(p_days_off public.weekday[])
returns table (success boolean, days_off public.weekday[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_days_off public.weekday[] := coalesce(p_days_off, '{}'::public.weekday[]);
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if array_length(v_days_off, 1) > 7 then
    raise exception 'too many days_off (max 7)' using errcode = '22023';
  end if;

  update public.users
  set regular_days_off = v_days_off,
      updated_at = v_now
  where id = v_user_id
    and withdrawal_requested_at is null;

  if not found then
    raise exception 'user not found or withdrawal in progress'
      using errcode = '02000';
  end if;

  return query select true, v_days_off;
end;
$$;

comment on function public.update_regular_days_off(public.weekday[]) is
  '정기휴무 요일 갱신 (FR-040). 변경 시점 이후부터 적용 (FR-044) — 과거 데이터 재계산 없음.';

revoke all on function public.update_regular_days_off(public.weekday[]) from public;
grant execute on function public.update_regular_days_off(public.weekday[]) to authenticated;
