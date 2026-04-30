-- Migration: public.users + 정기휴무 + 탈퇴 grace period + RLS
-- Spec: data-model.md §1, contracts/auth.md, FR-001/002/034~037/040/044
-- 헌법 IV (NON-NEGOTIABLE): 모든 테이블 RLS user_id 격리

create extension if not exists "uuid-ossp";

-- ─── 가게 유형 enum ─────────────────────────────────────────────
create type public.store_type as enum (
  'bingsu_cafe',
  'cafe',
  'dessert_cafe'
);

-- ─── 요일 약어 enum (정기휴무용) ────────────────────────────────
create type public.weekday as enum ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- ─── public.users ───────────────────────────────────────────────
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  store_name text not null,
  store_type public.store_type not null,
  regular_days_off public.weekday[] not null default '{}',
  signed_up_at timestamptz not null default now(),
  withdrawal_requested_at timestamptz,
  permanent_delete_at timestamptz,
  analytics_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- withdrawal 필드 일관성: 둘 다 NULL 또는 둘 다 NOT NULL
  constraint users_withdrawal_consistency check (
    (withdrawal_requested_at is null and permanent_delete_at is null)
    or (withdrawal_requested_at is not null and permanent_delete_at is not null)
  ),

  -- store_name 길이 (FR-001)
  constraint users_store_name_length check (char_length(store_name) between 1 and 50)
);

comment on table public.users is '사장님 도메인 프로필. auth.users와 1:1, store 정보 + 정기휴무 + 탈퇴 grace period 관리.';
comment on column public.users.regular_days_off is '정기휴무 요일 (FR-040). 빈 배열 = 365일 영업.';
comment on column public.users.withdrawal_requested_at is '탈퇴 신청일 (FR-034). NOT NULL이면 grace period 진입.';
comment on column public.users.permanent_delete_at is '영구 삭제 예정일 = withdrawal_requested_at + 30일 (FR-036).';

-- ─── updated_at 자동 갱신 트리거 ────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

-- ─── auth.users → public.users 자동 동기화 (가입 시 row 생성) ──
-- 가입 흐름: supabase.auth.signUp → auth.users 생성 → 트리거 → public.users 생성
-- raw_user_meta_data에 가게 정보를 클라이언트가 함께 보냄 (contracts/auth.md SignUpInput).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_store_name text := nullif(meta ->> 'store_name', '');
  v_store_type public.store_type;
  v_days_off public.weekday[];
begin
  -- store_type enum 캐스팅 (없으면 'cafe' 기본값)
  begin
    v_store_type := coalesce((meta ->> 'store_type')::public.store_type, 'cafe');
  exception when invalid_text_representation then
    v_store_type := 'cafe';
  end;

  -- regular_days_off enum 배열 캐스팅
  begin
    v_days_off := coalesce(
      array(select jsonb_array_elements_text(meta -> 'regular_days_off'))::public.weekday[],
      '{}'::public.weekday[]
    );
  exception when others then
    v_days_off := '{}'::public.weekday[];
  end;

  insert into public.users (id, email, store_name, store_type, regular_days_off)
  values (
    new.id,
    new.email,
    coalesce(v_store_name, '내 가게'),
    v_store_type,
    v_days_off
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- ─── RLS 정책 (헌법 IV 의무) ────────────────────────────────────
alter table public.users enable row level security;

create policy users_select_own
on public.users
for select
using (auth.uid() = id);

create policy users_update_own
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- INSERT는 트리거에서만, DELETE는 service role (Edge Function)에서만.
-- 명시적 정책 없음 → RLS가 거부.

grant select, update on public.users to authenticated;
