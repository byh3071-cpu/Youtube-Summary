-- 016: Harden an already-installed knowledge_jobs approval contract.
--
-- Apply after 014/015. This is intentionally a function-only upgrade: an
-- installation that already ran 012 or 014 will not be changed by editing
-- those historical SQL files, and 015 only resets action_required jobs.

begin;

create or replace function public.complete_knowledge_job(
  p_user_id uuid,
  p_job_id uuid,
  p_lease_token uuid,
  p_status text,
  p_result jsonb default '{}'::jsonb,
  p_quality_score smallint default null,
  p_quality_report jsonb default '{}'::jsonb,
  p_failure_code text default null,
  p_failure_message text default null
)
returns public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_job public.knowledge_jobs;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_user_id is null then
    raise exception 'owner user id required' using errcode = '22023';
  end if;

  -- Only complete_knowledge_approval may publish a completed record: it
  -- requires the approving state and the token created by begin_knowledge_approval.
  if p_status not in ('review_required', 'action_required') then
    raise exception 'invalid worker completion status: %', p_status;
  end if;

  update public.knowledge_jobs
  set
    status = p_status,
    result = coalesce(p_result, '{}'::jsonb),
    quality_score = p_quality_score,
    quality_report = coalesce(p_quality_report, '{}'::jsonb),
    failure_code = p_failure_code,
    failure_message = p_failure_message,
    lease_token = null,
    lease_owner = null,
    lease_expires_at = null,
    completed_at = null
  where id = p_job_id
    and user_id = p_user_id
    and status = 'processing'
    and lease_token = p_lease_token
    and lease_expires_at > now()
  returning * into completed_job;

  if not found then
    raise exception 'job lease is no longer valid';
  end if;
  return completed_job;
end;
$$;

revoke all on function public.complete_knowledge_job(uuid, uuid, uuid, text, jsonb, smallint, jsonb, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_knowledge_job(uuid, uuid, uuid, text, jsonb, smallint, jsonb, text, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
