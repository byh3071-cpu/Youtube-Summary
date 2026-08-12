-- 019: one-time recovery for the three P0 canaries exhausted by the
-- NotebookLM semantic-verdict JSON fence compatibility defect.
--
-- Applying this migration only installs the RPC. It does not mutate a job.
-- Invoke the RPC only after yohan-mcp PR #67 is present in the worker and
-- after a separate production approval. The immutable job allowlist, exact
-- failure predicate, and metadata marker keep this from becoming a general
-- fourth-attempt bypass.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.recover_knowledge_semantic_json_fence_canary(
  p_user_id uuid,
  p_job_id uuid
)
returns public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_job public.knowledge_jobs;
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
    attempt_count = 2,
    metadata = jsonb_set(
      coalesce(job.metadata, '{}'::jsonb),
      '{_semantic_json_fence_recovery_v1}',
      jsonb_build_object(
        'recovered_at', now(),
        'previous_attempt_count', job.attempt_count,
        'previous_failure_code', job.failure_code
      ),
      true
    ),
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
    and job.id in (
      'e8264ecd-269d-42a8-b1ec-65998d87dd62'::uuid,
      'be6f59de-691d-4461-9f6e-3c765330056b'::uuid,
      '63a4a8e4-503a-45fb-80a2-05d3a638df22'::uuid
    )
    and job.capture_ready = true
    and job.status = 'action_required'
    and job.attempt_count = 3
    and job.failure_code = 'NLM_EVIDENCE_NOT_SUPPORTED'
    and job.failure_message = 'Semantic evaluator returned malformed JSON.'
    and coalesce(job.metadata ->> '_semantic_json_fence_recovery_v1', '') = ''
    and nullif(trim(job.notebook_id), '') is not null
    and nullif(trim(job.notebook_source_id), '') is not null
    and job.source_hash ~ '^[0-9a-fA-F]{64}$'
    and job.transcript_hash ~ '^[0-9a-fA-F]{64}$'
  returning job.* into recovered_job;

  if not found then
    raise exception 'semantic JSON fence canary is not eligible for recovery';
  end if;
  return recovered_job;
end;
$$;

revoke all on function public.recover_knowledge_semantic_json_fence_canary(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.recover_knowledge_semantic_json_fence_canary(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
