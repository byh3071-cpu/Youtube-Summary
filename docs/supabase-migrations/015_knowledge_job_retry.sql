-- 015: service-role 전용 action_required 재처리 계약
--
-- 운영 Supabase에 자동 적용하지 않는다. SQL Editor에서 검토·승인 후 적용한다.
-- 기존 NotebookLM source 식별자와 hash는 보존하고, worker 산출물만 초기화한다.
-- 018 적용 후에는 이 파일을 다시 실행하지 않는다. 018이 retry 허용 코드 목록을
-- 확장해 이 함수 정의를 대체하며, 운영 적용 순서는 반드시 015 → 018이다.

begin;

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
      'QUALITY_GATE_FAILED'
    )
  returning job.* into retried_job;

  if not found then
    raise exception 'job is not eligible for retry';
  end if;
  return retried_job;
end;
$$;

revoke all on function public.retry_knowledge_job(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.retry_knowledge_job(uuid, uuid) to service_role;

commit;
