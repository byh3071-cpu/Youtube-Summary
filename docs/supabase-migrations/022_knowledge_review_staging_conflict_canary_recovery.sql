-- 022: one-time recovery for the first canary after an invalidated local
-- review candidate blocked the replacement review with write-once staging.
-- Installing this function does not mutate a job.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.recover_knowledge_review_staging_conflict_canary(
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
      '{_review_staging_conflict_recovery_v1}',
      jsonb_build_object(
        'recovered_at', now(),
        'previous_attempt_count', job.attempt_count,
        'previous_failure_code', job.failure_code,
        'required_yohan_mcp_fix', 'ReviewStore invalidated-review archival'
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
    and job.id = 'e8264ecd-269d-42a8-b1ec-65998d87dd62'::uuid
    and job.user_id = '8a805f4a-ab4c-475b-8b62-728df86f5ae7'::uuid
    and job.notebook_id = 'dde61734-4133-412d-8d6f-e60b7a387c2f'
    and job.notebook_source_id = '9eee7573-89e7-4ed2-ab8a-d8cfcfbb9c4e'
    and lower(job.source_hash) = 'a59856452f06e014e2d04659b7d17f4f1d045d53697f2deb447c4bf7c1a2c57d'
    and lower(job.transcript_hash) = '9efe06cd63696e3161f7c57898737ee069f10549215f49ade314b6e35cb479ff'
    and job.capture_ready = true
    and job.status = 'action_required'
    and job.attempt_count = 3
    and job.failure_code = 'NLM_PROCESSING_FAILED'
    and job.failure_message = '기존 검토 후보와 새 결과가 달라 덮어쓰지 않았습니다.'
    and coalesce(job.metadata ->> '_legacy_review_recovery_v1', 'false') = 'true'
    and jsonb_typeof(job.metadata -> '_semantic_json_fence_recovery_v1') = 'object'
    and jsonb_typeof(job.metadata -> '_public_caption_config_recovery_v1') = 'object'
    and jsonb_typeof(job.metadata -> '_candidate_selection_format_recovery_v1') = 'object'
    and coalesce(job.metadata ->> '_review_staging_conflict_recovery_v1', '') = ''
  returning job.* into recovered_job;

  if not found then
    raise exception 'review staging conflict canary is not eligible for recovery';
  end if;
  return recovered_job;
end;
$$;

revoke all on function public.recover_knowledge_review_staging_conflict_canary(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.recover_knowledge_review_staging_conflict_canary(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
