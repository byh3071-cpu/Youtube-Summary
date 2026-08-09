-- 018: service-role 전용 레거시 검토 무효화 계약
--
-- 016 이전 엔진이 review_required로 남긴 불완전한 근거를 승인하지 않고
-- action_required로 되돌린다. NotebookLM source 식별자와 hash, 기존 검토
-- 산출물은 감사용으로 보존하며, 후속 retry_knowledge_job 호출이 worker
-- 산출물만 초기화하고 같은 source를 다시 처리한다. 과거 엔진에서 이미
-- 3회에 도달한 행은 metadata marker를 남기고 딱 한 번만 2회로 되돌려
-- 마지막 교정 시도를 허용한다. marker가 있으면 같은 예외를 반복할 수 없다.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.invalidate_knowledge_review(
  p_user_id uuid,
  p_job_id uuid
)
returns public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  invalidated_job public.knowledge_jobs;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_job_id is null then
    raise exception 'owner user id and job id required' using errcode = '22023';
  end if;

  update public.knowledge_jobs as job
  set
    status = 'action_required',
    attempt_count = case when job.attempt_count = 3 then 2 else job.attempt_count end,
    metadata = jsonb_set(
      coalesce(job.metadata, '{}'::jsonb),
      '{_legacy_review_recovery_v1}',
      'true'::jsonb,
      true
    ),
    failure_code = 'PUBLIC_CAPTION_TIMESTAMPS_REQUIRED',
    failure_message = 'legacy review evidence must be reprocessed with verified public-caption timestamps',
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
    and job.status = 'review_required'
    and job.attempt_count <= 3
    and coalesce(job.metadata ->> '_legacy_review_recovery_v1', 'false') <> 'true'
  returning job.* into invalidated_job;

  if not found then
    raise exception 'knowledge review is not eligible for invalidation';
  end if;
  return invalidated_job;
end;
$$;

-- 015 may already be installed. Replace the live retry function so the fixed
-- invalidation reason is eligible without editing historical migration 015.
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

revoke all on function public.invalidate_knowledge_review(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.invalidate_knowledge_review(uuid, uuid) to service_role;

revoke all on function public.retry_knowledge_job(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.retry_knowledge_job(uuid, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
