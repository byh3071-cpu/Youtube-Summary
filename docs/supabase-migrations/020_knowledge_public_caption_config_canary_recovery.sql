-- 020: one-time recovery for the three P0 canaries consumed while the
-- public-caption processing flag was absent from the local worker runtime.
--
-- Applying this migration only installs the RPC. It does not mutate a job.
-- Invoke the RPC only after the yohan-mcp worker refuses to claim without
-- KNOWLEDGE_ALLOW_EXTERNAL_TRANSCRIPT_FETCH=1, the operator has enabled that
-- flag, and a separate production approval has been given.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.recover_knowledge_public_caption_config_canary(
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
      '{_public_caption_config_recovery_v1}',
      jsonb_build_object(
        'recovered_at', now(),
        'previous_attempt_count', job.attempt_count,
        'previous_failure_code', job.failure_code,
        'required_worker_config', 'KNOWLEDGE_ALLOW_EXTERNAL_TRANSCRIPT_FETCH=1'
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
            '0c65faf07d0ddff11d9b12bf74fa34c9949d05d64d9857f7b614bdc05e9a7a65',
            'QUALITY_GATE_FAILED',
            '영상 시작·중간·끝 커버리지가 모두 필요합니다. 모든 사실 주장에는 타임스탬프 인용이 필요합니다.'
          ),
          (
            'be6f59de-691d-4461-9f6e-3c765330056b'::uuid,
            'dde61734-4133-412d-8d6f-e60b7a387c2f',
            '5187e4ec-4232-4276-aff5-be0cb387688c',
            '64804b07c4bd1b9048964412dbe8e10e36dacd8dbdf29464bf986dc36c0cbf62',
            '196c2449575cf7a1948af4ab229f7664eff9143514c69a7440945645425a969d',
            'NLM_EVIDENCE_NOT_GROUNDED',
            'NotebookLM source get 원문에 근거 문구가 없습니다.'
          ),
          (
            '63a4a8e4-503a-45fb-80a2-05d3a638df22'::uuid,
            'dde61734-4133-412d-8d6f-e60b7a387c2f',
            '4e185478-3cce-4387-97b5-e3d85d5dfa2c',
            'e08441c396cf9029b4529e411e16ac74018a0aeba6ef0b59b5f80021928752ae',
            '22b24089a8e6263dec3fee2f0f6adfbf349e334503930882b4cb6446eac554e2',
            'QUALITY_GATE_FAILED',
            '영상 시작·중간·끝 커버리지가 모두 필요합니다. 모든 사실 주장에는 타임스탬프 인용이 필요합니다.'
          )
      ) as approved(
        job_id,
        notebook_id,
        notebook_source_id,
        source_hash,
        transcript_hash,
        failure_code,
        failure_message
      )
      where approved.job_id = job.id
        and approved.notebook_id = job.notebook_id
        and approved.notebook_source_id = job.notebook_source_id
        and approved.source_hash = lower(job.source_hash)
        and approved.transcript_hash = lower(job.transcript_hash)
        and approved.failure_code = job.failure_code
        and approved.failure_message = job.failure_message
    )
    and job.capture_ready = true
    and job.status = 'action_required'
    and job.attempt_count = 3
    and jsonb_typeof(job.metadata -> '_semantic_json_fence_recovery_v1') = 'object'
    and coalesce(job.metadata ->> '_public_caption_config_recovery_v1', '') = ''
  returning job.* into recovered_job;

  if not found then
    raise exception 'public caption config canary is not eligible for recovery';
  end if;
  return recovered_job;
end;
$$;

revoke all on function public.recover_knowledge_public_caption_config_canary(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.recover_knowledge_public_caption_config_canary(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
