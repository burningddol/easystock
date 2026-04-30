-- Migration: 탈퇴 grace period 인덱스
-- Spec: data-model.md §1, FR-034~037
-- Edge Function `permanent-delete`가 매일 cron으로 만료 사용자 batch query 시 사용.

-- 탈퇴 신청한 사용자만 부분 인덱스 (NULL이 대부분이므로 효율적)
create index users_pending_deletion_idx
on public.users (permanent_delete_at)
where withdrawal_requested_at is not null;

comment on index public.users_pending_deletion_idx is 'permanent-delete Edge Function이 만료 사용자 조회에 사용 (FR-036).';
