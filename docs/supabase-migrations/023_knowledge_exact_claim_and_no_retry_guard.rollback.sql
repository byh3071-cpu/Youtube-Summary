-- Rollback for 023 before any exact-job caller depends on it.
-- Row transitions already produced by 023 are intentionally preserved.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if exists (
    select 1
    from public.knowledge_jobs as job
    where coalesce(job.metadata ->> '_canary_hold', 'false') = 'true'
      and job.status in ('queued', 'processing')
  ) then
    raise exception 'settle or explicitly release held canary rows before rolling back 023';
  end if;
end;
$$;

drop function if exists public.claim_knowledge_job_by_id(uuid, uuid, text, integer);

-- Restore the standard claim implementation from migration 014.
create or replace function public.claim_knowledge_jobs(
  p_user_id uuid,
  p_worker_id text,
  p_limit integer default 3,
  p_lease_seconds integer default 900
)
returns setof public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 3), 3));
  v_lease_seconds integer := greatest(60, least(coalesce(p_lease_seconds, 900), 3600));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_user_id is null then
    raise exception 'owner user id required' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_worker_id, ''))) = 0 then
    raise exception 'worker id required';
  end if;

  update public.knowledge_jobs
  set
    status = 'action_required',
    failure_code = 'max_attempts_exceeded',
    failure_message = 'worker lease expired after 3 attempts',
    lease_token = null,
    lease_owner = null,
    lease_expires_at = null
  where user_id = p_user_id
    and attempt_count >= 3
    and (
      status = 'queued'
      or (status = 'processing' and lease_expires_at < now())
    );

  return query
  with candidates as (
    select id
    from public.knowledge_jobs
    where user_id = p_user_id
      and capture_ready = true
      and attempt_count < 3
      and (
        status = 'queued'
        or (status = 'processing' and lease_expires_at < now())
      )
    order by created_at asc
    for update skip locked
    limit v_limit
  )
  update public.knowledge_jobs as job
  set
    status = 'processing',
    lease_token = gen_random_uuid(),
    lease_owner = left(trim(p_worker_id), 120),
    lease_expires_at = now() + make_interval(secs => v_lease_seconds),
    attempt_count = job.attempt_count + 1,
    last_processed_at = now(),
    failure_code = null,
    failure_message = null
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;

-- Restore the retry implementation from migration 018.
create or replace function public.retry_knowledge_job(
  p_user_id uuid,
  p_job_id uuid
)
returns public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  retried_job public.knowledge_jobs;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_user_id is null or p_job_id is null then
    raise exception 'owner user id and job id required' using errcode = '22023';
  end if;

  update public.knowledge_jobs as job
  set
    status = 'queued',
    result = '{}'::jsonb,
    quality_score = null,
    quality_report = '{}'::jsonb,
    failure_code = null,
    failure_message = null,
    approval_token = null,
    approval_started_at = null,
    approval_intent_hash = null,
    lease_token = null,
    lease_owner = null,
    lease_expires_at = null,
    completed_at = null
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.capture_ready = true
    and job.status = 'action_required'
    and job.attempt_count < 3
    and job.failure_code in (
      'YTDLP_CAPTION_FETCH_FAILED',
      'NOTEBOOKLM_AUTH_REQUIRED',
      'NOTEBOOKLM_SOURCE_NOT_READY',
      'NOTEBOOKLM_LIMIT_REACHED',
      'NLM_PROCESSING_FAILED',
      'NLM_QUERY_NOT_STRUCTURED',
      'NLM_EVIDENCE_NOT_GROUNDED',
      'QUALITY_GATE_FAILED',
      'PUBLIC_CAPTION_TIMESTAMPS_REQUIRED'
    )
  returning job.* into retried_job;

  if not found then
    raise exception 'job is not eligible for retry';
  end if;
  return retried_job;
end;
$$;

revoke all on function public.claim_knowledge_jobs(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_knowledge_jobs(uuid, text, integer, integer) to service_role;
revoke all on function public.retry_knowledge_job(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.retry_knowledge_job(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
