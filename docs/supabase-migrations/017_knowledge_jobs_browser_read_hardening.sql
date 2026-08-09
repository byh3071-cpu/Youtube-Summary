-- Close the legacy browser-readable knowledge_jobs surface after 014/015/016.
-- This migration changes policies and grants only; it does not update job rows.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop policy if exists "knowledge_jobs_select_own" on public.knowledge_jobs;
revoke all privileges on table public.knowledge_jobs from anon, authenticated;

notify pgrst, 'reload schema';

commit;
