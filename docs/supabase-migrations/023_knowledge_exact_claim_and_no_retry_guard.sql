-- 023: reusable exact-job claim and clean-canary no-retry contract.
-- This migration contains no job UUID and never requeues an existing job.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'owner user id required' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_worker_id, ''))) = 0 then
    raise exception 'worker id required' using errcode = '22023';
  end if;

  -- A clean canary is single-attempt by contract. An expired lease is a
  -- terminal diagnostic result, not permission to run the same input again.
  update public.knowledge_jobs as job
  set
    status = 'action_required',
    failure_code = 'CANARY_LEASE_EXPIRED',
    failure_message = 'clean canary lease expired; the same job will not be retried',
    lease_token = null,
    lease_owner = null,
    lease_expires_at = null
  where job.user_id = p_user_id
    and job.status = 'processing'
    and job.lease_expires_at < now()
    and coalesce(job.metadata ->> '_canary_no_retry', 'false') = 'true';

  update public.knowledge_jobs as job
  set
    status = 'action_required',
    failure_code = 'LEASE_ATTEMPTS_EXHAUSTED',
    failure_message = 'knowledge job exhausted its processing attempts',
    lease_token = null,
    lease_owner = null,
    lease_expires_at = null
  where job.user_id = p_user_id
    and job.capture_ready = true
    and job.attempt_count >= 3
    and (
      job.status = 'queued'
      or (job.status = 'processing' and job.lease_expires_at < now())
    );

  return query
  with candidates as (
    select job.id
    from public.knowledge_jobs as job
    where job.user_id = p_user_id
      and job.capture_ready = true
      and job.attempt_count < 3
      and coalesce(job.metadata ->> '_canary_hold', 'false') <> 'true'
      and (
        job.status = 'queued'
        or (
          job.status = 'processing'
          and job.lease_expires_at < now()
          and coalesce(job.metadata ->> '_canary_no_retry', 'false') <> 'true'
        )
      )
    order by job.created_at asc
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

create or replace function public.claim_knowledge_job_by_id(
  p_user_id uuid,
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 900
)
returns public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease_seconds integer := greatest(60, least(coalesce(p_lease_seconds, 900), 3600));
  claimed_job public.knowledge_jobs;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_job_id is null then
    raise exception 'owner user id and job id required' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_worker_id, ''))) = 0 then
    raise exception 'worker id required' using errcode = '22023';
  end if;

  update public.knowledge_jobs as job
  set
    status = 'action_required',
    failure_code = 'CANARY_LEASE_EXPIRED',
    failure_message = 'clean canary lease expired; the same job will not be retried',
    lease_token = null,
    lease_owner = null,
    lease_expires_at = null
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.status = 'processing'
    and job.lease_expires_at < now()
    and coalesce(job.metadata ->> '_canary_no_retry', 'false') = 'true'
  returning job.* into claimed_job;
  if found then
    return claimed_job;
  end if;

  update public.knowledge_jobs as job
  set
    status = 'action_required',
    failure_code = 'LEASE_ATTEMPTS_EXHAUSTED',
    failure_message = 'knowledge job exhausted its processing attempts',
    lease_token = null,
    lease_owner = null,
    lease_expires_at = null
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.capture_ready = true
    and job.attempt_count >= 3
    and (
      job.status = 'queued'
      or (job.status = 'processing' and job.lease_expires_at < now())
    )
  returning job.* into claimed_job;
  if found then
    return claimed_job;
  end if;

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
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.capture_ready = true
    and job.attempt_count < 3
    and job.status = 'queued'
  returning job.* into claimed_job;

  if not found then
    raise exception 'exact knowledge job is not eligible for claim' using errcode = 'P0001';
  end if;
  return claimed_job;
end;
$$;

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
    raise exception 'service_role required' using errcode = '42501';
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
    and coalesce(job.metadata ->> '_canary_no_retry', 'false') <> 'true'
    and not (
      coalesce(job.metadata, '{}'::jsonb) ?| array[
        '_legacy_review_recovery_v1',
        '_semantic_json_fence_recovery_v1',
        '_public_caption_config_recovery_v1',
        '_candidate_selection_format_recovery_v1',
        '_review_staging_conflict_recovery_v1'
      ]
    )
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
    raise exception 'job is not eligible for retry' using errcode = 'P0001';
  end if;
  return retried_job;
end;
$$;

revoke all on function public.claim_knowledge_jobs(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_knowledge_jobs(uuid, text, integer, integer)
  to service_role;

revoke all on function public.claim_knowledge_job_by_id(uuid, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_knowledge_job_by_id(uuid, uuid, text, integer)
  to service_role;

revoke all on function public.retry_knowledge_job(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.retry_knowledge_job(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
