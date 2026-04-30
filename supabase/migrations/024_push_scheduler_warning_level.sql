-- Migration: invoke_push_scheduler 경고 레벨 강화
-- raise notice → raise warning (cron 로그 가시성 향상)
-- + comment 갱신: docs/setup-push.md 링크.

create or replace function private.invoke_push_scheduler(p_type text)
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
    raise warning 'service_role_key not in Supabase Vault — push-scheduler 호출 skip. docs/setup-push.md 참조';
    return null;
  end if;

  select net.http_post(
    url := v_project_url || '/functions/v1/push-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('type', p_type)
  ) into v_request_id;

  return v_request_id;
end;
$$;

comment on function private.invoke_push_scheduler(text) is
  '⚠ pg_cron → Edge Function 트리거. Vault에 service_role_key 미등록 시 raise warning + null return → 푸시 발송 안 됨 (조용한 실패). docs/setup-push.md 참조.';
