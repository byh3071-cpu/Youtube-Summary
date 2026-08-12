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
    and exists (
      select 1
      from (
        values
          (
            'e8264ecd-269d-42a8-b1ec-65998d87dd62'::uuid,
            'dde61734-4133-412d-8d6f-e60b7a387c2f',
            '9eee7573-89e7-4ed2-ab8a-d8cfcfbb9c4e',
            'a59856452f06e014e2d04659b7d17f4f1d045d53697f2deb447c4bf7c1a2c57d',
            '9efe06cd63696e3161f7c57898737ee069f10549215f49ade314b6e35cb479ff'
          ),
          (
            'be6f59de-691d-4461-9f6e-3c765330056b'::uuid,
            'dde61734-4133-412d-8d6f-e60b7a387c2f',
            '5187e4ec-4232-4276-aff5-be0cb387688c',
            '64804b07c4bd1b9048964412dbe8e10e36dacd8dbdf29464bf986dc36c0cbf62',
            '49d3f4144104c976218733f69cf24af8022c55890bbc956569dd8173f30175d7'
          ),
          (
            '63a4a8e4-503a-45fb-80a2-05d3a638df22'::uuid,
            'dde61734-4133-412d-8d6f-e60b7a387c2f',
            '4e185478-3cce-4387-97b5-e3d85d5dfa2c',
            'e08441c396cf9029b4529e411e16ac74018a0aeba6ef0b59b5f80021928752ae',
            '6cbe62d8ca806bca3f5b252507d8a86a935825f9106653499559b87815bb7c99'
          )
      ) as approved(job_id, notebook_id, notebook_source_id, source_hash, transcript_hash)
      where approved.job_id = job.id
        and approved.notebook_id = job.notebook_id
        and approved.notebook_source_id = job.notebook_source_id
        and approved.source_hash = lower(job.source_hash)
        and approved.transcript_hash = lower(job.transcript_hash)
    )
    and job.capture_ready = true
    and job.status = 'action_required'
    and job.attempt_count = 3
    and job.failure_code = 'NLM_EVIDENCE_NOT_SUPPORTED'
    and job.failure_message = 'Semantic evaluator returned malformed JSON.'
    and coalesce(job.metadata ->> '_semantic_json_fence_recovery_v1', '') = ''
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
