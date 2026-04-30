-- Migration: pg_cron 스케줄 — d7-tracker Edge Function 호출 (Phase 8 / T166)
-- Spec: SC-008 funnel "d7_active" — D7 retention 측정.
--
-- 사전 요구 (push 인프라와 동일, docs/setup-push.md 참조):
--   pg_cron / pg_net 확장 + Vault에 service_role_key + Edge Function `d7-tracker` 배포 +
--   Edge Function secrets에 GA4_MEASUREMENT_ID / GA4_API_SECRET 등록
--
-- 시각: 매일 02:00 UTC = 11:00 KST. 아침 발주 알림(09:00 KST) 처리 직후 시점이라
-- 사용자 활동 신호(첫 sale 입력)가 누적된 상태.

-- 사전 검증
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron not enabled. Supabase 대시보드 → Database → Extensions';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net not enabled. Supabase 대시보드 → Database → Extensions';
  end if;
end;
$$;

create schema if not exists private;
grant usage on schema private to postgres;

create or replace function private.invoke_d7_tracker()
returns bigint
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_project_url text := 'https://csekgdftbaomeqlcaohk.supabase.co';
  v_service_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'service_role_key';

  if v_service_key is null then
    raise warning 'service_role_key not in Supabase Vault — d7-tracker 호출 skip. docs/setup-push.md 참조';
    return null;
  end if;

  select net.http_post(
    url := v_project_url || '/functions/v1/d7-tracker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb
  ) into v_request_id;

  return v_request_id;
end;
$$;

comment on function private.invoke_d7_tracker() is
  '⚠ pg_cron → d7-tracker Edge Function. Vault에 service_role_key + Edge Function secrets에 GA4_MEASUREMENT_ID/GA4_API_SECRET 미등록 시 silent no-op (return null 또는 sent_count=0).';

-- 기존 스케줄 제거 후 재등록 (멱등성)
do $$
begin
  perform cron.unschedule('d7_active_tracker');
  exception when others then null;
end;
$$;

select cron.schedule(
  'd7_active_tracker',
  '0 2 * * *',
  $$select private.invoke_d7_tracker();$$
);
