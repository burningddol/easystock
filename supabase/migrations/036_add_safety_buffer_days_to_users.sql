-- Migration: 사용자별 재고 예측 안전여유일 설정
-- Settings에서 조정하는 예측 기준값. 상태 분류 시 lead_time_days와 함께 사용.

alter table public.users
add column if not exists safety_buffer_days integer not null default 1;

alter table public.users
drop constraint if exists users_safety_buffer_days_range;

alter table public.users
add constraint users_safety_buffer_days_range
check (safety_buffer_days between 0 and 7);

comment on column public.users.safety_buffer_days is
  '재고 소진 예측 안전여유일. 상태 분류 시 리드타임과 함께 차감한다. 기본 1일.';
