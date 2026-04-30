-- Migration: pg_cron 스케줄 — push-scheduler Edge Function 호출
-- Spec: contracts/push.md, FR-013 / FR-015
--
-- ─── 사전 요구 (Supabase 대시보드에서 수동 1회) ─────────────────
-- 1) Database → Extensions: pg_cron, pg_net 활성화
-- 2) Database → Vault → New secret:
--      name: service_role_key
--      secret: <service_role JWT (Settings → API에서 복사)>
-- 3) Edge Function `push-scheduler` 배포 (.github/workflows/deploy-edge-functions.yml)
-- 4) Edge Function secrets:
--      VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
--      (대시보드 → Edge Functions → Secrets)
--
-- 시각 (KST → UTC):
--   09:00 KST = 00:00 UTC → 매일 발주 점검 (order_alert)
--   22:00 KST = 13:00 UTC → 매일 마감 후 판매 입력 (closing_reminder)
--   일 07:00 KST = 토 22:00 UTC → 주간 재고 실사 (stock_count, day-of-week=6 in cron UTC)
--
-- 사전 요구 미충족 시 cron.schedule 호출 자체는 성공하지만 실행 시점에 실패.
-- Vault에 service_role_key가 있어야 Edge Function 호출 가능.

-- 사전 검증: extensions 활성화 확인
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

-- 호출 SQL을 함수로 묶어 cron 정의 단순화
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
  -- Vault에서 service_role_key 읽기 (사전 요구 2번)
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

-- 기존 스케줄 제거 후 재등록 (멱등성)
do $$
begin
  perform cron.unschedule('push_order_alert');
  exception when others then null;
end;
$$;
do $$
begin
  perform cron.unschedule('push_closing_reminder');
  exception when others then null;
end;
$$;
do $$
begin
  perform cron.unschedule('push_stock_count');
  exception when others then null;
end;
$$;

select cron.schedule(
  'push_order_alert',
  '0 0 * * *',
  $$select private.invoke_push_scheduler('order_alert');$$
);

select cron.schedule(
  'push_closing_reminder',
  '0 13 * * *',
  $$select private.invoke_push_scheduler('closing_reminder');$$
);

select cron.schedule(
  'push_stock_count',
  '0 22 * * 6',
  $$select private.invoke_push_scheduler('stock_count');$$
);

comment on function private.invoke_push_scheduler(text) is
  '⚠ pg_cron → Edge Function 트리거. Vault에 service_role_key 미등록 시 raise notice + null return → 푸시 발송 안 됨 (조용한 실패). docs/setup-push.md 참조.';
