-- Migration: push_subscriptions table + subscribe_push / unsubscribe_push RPCs
-- Spec: data-model.md §10, contracts/push.md
-- 헌법 IV: user_id 격리 RLS

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null,
  keys_p256dh text not null,
  keys_auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,

  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

comment on table public.push_subscriptions is
  '브라우저 푸시 구독. endpoint unique → 같은 디바이스 재구독 시 upsert.';
comment on column public.push_subscriptions.last_used_at is
  '마지막 푸시 발송 성공 시각. push-scheduler Edge Function이 갱신.';

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_isolated
on public.push_subscriptions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select on public.push_subscriptions to authenticated;
-- INSERT/DELETE는 RPC만 (service definer로 endpoint conflict 처리)

-- ─── subscribe_push RPC ────────────────────────────────────────
create or replace function public.subscribe_push(
  p_endpoint text,
  p_keys_p256dh text,
  p_keys_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 같은 endpoint가 있으면 user_id 갱신 + last_used_at 초기화 (재구독)
  insert into public.push_subscriptions (
    user_id, endpoint, keys_p256dh, keys_auth, user_agent
  ) values (
    v_user_id, p_endpoint, p_keys_p256dh, p_keys_auth, p_user_agent
  )
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      keys_p256dh = excluded.keys_p256dh,
      keys_auth = excluded.keys_auth,
      user_agent = excluded.user_agent,
      last_used_at = null
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.subscribe_push(text, text, text, text) is
  '푸시 구독 등록. endpoint unique 충돌 시 갱신 (재구독 시나리오).';

revoke all on function public.subscribe_push(text, text, text, text) from public;
grant execute on function public.subscribe_push(text, text, text, text) to authenticated;

-- ─── unsubscribe_push RPC ──────────────────────────────────────
create or replace function public.unsubscribe_push(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id = v_user_id;
end;
$$;

comment on function public.unsubscribe_push(text) is
  '푸시 구독 해제. 본인 endpoint만 삭제.';

revoke all on function public.unsubscribe_push(text) from public;
grant execute on function public.unsubscribe_push(text) to authenticated;
