-- 014: Upgrade an existing legacy knowledge_jobs P0 installation in place.
--
-- Apply only after knowledge_workflow_preflight.sql confirms that
-- public.knowledge_jobs exists and public.knowledge_process_requests does not.
-- This migration preserves rows, adds the approval contract, installs the
-- user-scoped worker RPCs, removes the three unsafe legacy overloads, and
-- tightens EXECUTE privileges. It intentionally does not install P1/013.

begin;

-- Fail quickly instead of leaving the SQL Editor session or live API writes
-- waiting behind an unexpected production lock.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  v_column record;
begin
  if to_regclass('public.knowledge_jobs') is null then
    raise exception 'public.knowledge_jobs is required for legacy upgrade';
  end if;

  for v_column in
    select column_name, udt_name, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_jobs'
      and column_name in ('approval_token', 'approval_started_at', 'approval_intent_hash')
  loop
    if (v_column.column_name = 'approval_token'
        and (v_column.udt_name <> 'uuid' or v_column.is_nullable <> 'YES'))
       or (v_column.column_name = 'approval_started_at'
        and (v_column.udt_name <> 'timestamptz' or v_column.is_nullable <> 'YES'))
       or (v_column.column_name = 'approval_intent_hash'
        and (v_column.udt_name <> 'text' or v_column.is_nullable <> 'YES')) then
      raise exception 'unexpected existing approval column contract: %', v_column.column_name;
    end if;
  end loop;
end;
$$;

alter table public.knowledge_jobs
  add column if not exists approval_token uuid,
  add column if not exists approval_started_at timestamptz,
  add column if not exists approval_intent_hash text;

alter table public.knowledge_jobs
  drop constraint if exists knowledge_jobs_status_check;
alter table public.knowledge_jobs
  add constraint knowledge_jobs_status_check check (status in (
    'queued', 'processing', 'review_required', 'approving', 'completed',
    'action_required', 'failed', 'cancelled'
  )) not valid;
alter table public.knowledge_jobs
  validate constraint knowledge_jobs_status_check;

drop index if exists public.idx_knowledge_jobs_worker_queue;
create index idx_knowledge_jobs_worker_queue
  on public.knowledge_jobs (user_id, status, lease_expires_at, created_at);

alter table public.knowledge_jobs enable row level security;

drop policy if exists "knowledge_jobs_select_own" on public.knowledge_jobs;

drop policy if exists "knowledge_jobs_insert_own" on public.knowledge_jobs;
create policy "knowledge_jobs_insert_own"
  on public.knowledge_jobs for insert
  with check (
    auth.uid() = user_id
    and source_type = 'youtube'
    and source_key = video_id
    and video_id ~ '^[A-Za-z0-9_-]{6,64}$'
    and source_url = 'https://www.youtube.com/watch?v=' || video_id
    and char_length(title) between 1 and 300
    and (channel_name is null or char_length(channel_name) <= 180)
    and char_length(source_guide) <= 20000
    and capture_ready = false
    and tier = 'T2'
    and status = 'queued'
    and source_hash is null
    and transcript_hash is null
    and notebook_id is null
    and notebook_name is null
    and notebook_source_id is null
    and notebook_source_added_at is null
    and quality_score is null
    and quality_report = '{}'::jsonb
    and result = '{}'::jsonb
    and failure_code is null
    and failure_message is null
    and approval_token is null
    and approval_started_at is null
    and approval_intent_hash is null
    and lease_token is null
    and lease_owner is null
    and lease_expires_at is null
    and attempt_count = 0
    and last_processed_at is null
    and completed_at is null
  );

revoke all privileges on table public.knowledge_jobs from anon, authenticated;

create or replace function public.enqueue_knowledge_job(
  p_source_type text,
  p_source_key text,
  p_source_url text,
  p_video_id text,
  p_title text,
  p_channel_name text default null,
  p_source_guide text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  video_id text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  capture_ready boolean,
  created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.knowledge_jobs;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;
  if p_source_type is distinct from 'youtube'
     or p_source_key is distinct from p_video_id
     or p_video_id is null
     or p_video_id !~ '^[A-Za-z0-9_-]{6,64}$'
     or p_source_url is distinct from 'https://www.youtube.com/watch?v=' || p_video_id
     or char_length(trim(coalesce(p_title, ''))) not between 1 and 300
     or char_length(coalesce(p_channel_name, '')) > 180
     or char_length(coalesce(p_source_guide, '')) > 20000
     or pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 16384 then
    raise exception 'invalid knowledge capture input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select job.* into v_job
  from public.knowledge_jobs as job
  where job.user_id = v_user_id
    and job.source_type = p_source_type
    and job.source_key = p_source_key;
  if found then
    return query select v_job.id, v_job.video_id, v_job.status,
      v_job.created_at, v_job.updated_at, v_job.capture_ready, false;
    return;
  end if;

  if (
    select count(*) from public.knowledge_jobs as job
    where job.user_id = v_user_id and job.status in ('queued', 'processing')
  ) >= 10 then
    raise exception 'knowledge_queue_active_limit' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.knowledge_jobs as job
    where job.user_id = v_user_id
      and job.created_at >= date_trunc('day', now())
  ) >= 50 then
    raise exception 'knowledge_queue_daily_limit' using errcode = 'P0001';
  end if;

  insert into public.knowledge_jobs (
    user_id, source_type, source_key, source_url, video_id,
    title, channel_name, source_guide, metadata
  ) values (
    v_user_id, p_source_type, p_source_key, p_source_url, p_video_id,
    trim(p_title), nullif(trim(coalesce(p_channel_name, '')), ''),
    coalesce(p_source_guide, ''), coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_job;

  return query select v_job.id, v_job.video_id, v_job.status,
    v_job.created_at, v_job.updated_at, v_job.capture_ready, true;
end;
$$;

create or replace function public.enrich_knowledge_job(
  p_job_id uuid,
  p_title text,
  p_channel_name text,
  p_source_guide text
)
returns table (
  id uuid,
  video_id text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  capture_ready boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.knowledge_jobs;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or v_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 300
     or char_length(coalesce(p_channel_name, '')) > 180
     or char_length(coalesce(p_source_guide, '')) > 20000 then
    raise exception 'invalid knowledge enrichment input' using errcode = '22023';
  end if;

  update public.knowledge_jobs as job
  set
    title = trim(p_title),
    channel_name = nullif(trim(coalesce(p_channel_name, '')), ''),
    source_guide = coalesce(p_source_guide, ''),
    capture_ready = true
  where job.id = p_job_id
    and job.user_id = v_user_id
    and job.status = 'queued'
    and job.capture_ready = false
  returning job.* into v_job;

  if not found then
    select job.* into v_job
    from public.knowledge_jobs as job
    where job.id = p_job_id
      and job.user_id = v_user_id
      and job.capture_ready = true;
  end if;
  if not found then return; end if;
  return query select v_job.id, v_job.video_id, v_job.status,
    v_job.created_at, v_job.updated_at, v_job.capture_ready;
end;
$$;

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

create or replace function public.checkpoint_knowledge_job(
  p_user_id uuid,
  p_job_id uuid,
  p_lease_token uuid,
  p_notebook_id text default null,
  p_notebook_name text default null,
  p_notebook_source_id text default null,
  p_notebook_source_added_at timestamptz default null,
  p_source_hash text default null,
  p_transcript_hash text default null,
  p_lease_seconds integer default 900
)
returns public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  checkpointed_job public.knowledge_jobs;
  v_lease_seconds integer := greatest(60, least(coalesce(p_lease_seconds, 900), 3600));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_user_id is null then
    raise exception 'owner user id required' using errcode = '22023';
  end if;

  update public.knowledge_jobs as job
  set
    notebook_id = coalesce(p_notebook_id, job.notebook_id),
    notebook_name = coalesce(p_notebook_name, job.notebook_name),
    notebook_source_id = coalesce(p_notebook_source_id, job.notebook_source_id),
    notebook_source_added_at = coalesce(p_notebook_source_added_at, job.notebook_source_added_at),
    source_hash = coalesce(p_source_hash, job.source_hash),
    transcript_hash = coalesce(p_transcript_hash, job.transcript_hash),
    lease_expires_at = now() + make_interval(secs => v_lease_seconds)
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.status = 'processing'
    and job.lease_token = p_lease_token
    and job.lease_expires_at > now()
  returning job.* into checkpointed_job;

  if not found then
    raise exception 'job lease is no longer valid';
  end if;
  return checkpointed_job;
end;
$$;

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
  -- Keep upgraded installations on the same approval CAS path as fresh 012
  -- installs: workers may not publish a completed job directly.
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

create or replace function public.begin_knowledge_approval(
  p_user_id uuid,
  p_job_id uuid,
  p_intent_hash text
)
returns public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.knowledge_jobs;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'owner user id required' using errcode = '22023';
  end if;
  if p_intent_hash is null or p_intent_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid approval intent' using errcode = '22023';
  end if;

  select * into v_job
  from public.knowledge_jobs
  where id = p_job_id
    and user_id = p_user_id
  for update;
  if not found then
    raise exception 'knowledge job not found';
  end if;
  if v_job.status = 'completed' then
    return v_job;
  end if;
  if v_job.status = 'approving' then
    if v_job.approval_intent_hash is distinct from p_intent_hash then
      raise exception 'approval already in progress with different intent';
    end if;
    return v_job;
  end if;
  if v_job.status <> 'review_required' then
    raise exception 'knowledge job is not reviewable';
  end if;

  update public.knowledge_jobs
  set status = 'approving',
      approval_token = gen_random_uuid(),
      approval_started_at = now(),
      approval_intent_hash = p_intent_hash
  where id = p_job_id and user_id = p_user_id and status = 'review_required'
  returning * into v_job;
  if not found then
    raise exception 'approval claim lost';
  end if;
  return v_job;
end;
$$;

create or replace function public.complete_knowledge_approval(
  p_user_id uuid,
  p_job_id uuid,
  p_approval_token uuid,
  p_result jsonb default '{}'::jsonb
)
returns public.knowledge_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.knowledge_jobs;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'owner user id required' using errcode = '22023';
  end if;

  update public.knowledge_jobs
  set status = 'completed',
      result = coalesce(p_result, '{}'::jsonb),
      completed_at = now()
  where id = p_job_id
    and user_id = p_user_id
    and status = 'approving'
    and approval_token = p_approval_token
  returning * into v_job;
  if found then return v_job; end if;

  select * into v_job
  from public.knowledge_jobs
  where id = p_job_id
    and user_id = p_user_id
    and status = 'completed'
    and approval_token = p_approval_token;
  if not found then
    raise exception 'approval claim is no longer valid';
  end if;
  return v_job;
end;
$$;

-- User RPCs are callable only by signed-in users. Revoke explicit grants as
-- well as PUBLIC because older installations may have granted roles directly.
revoke all on function public.enqueue_knowledge_job(text, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.enrich_knowledge_job(uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_knowledge_job(text, text, text, text, text, text, text, jsonb)
  to authenticated;
grant execute on function public.enrich_knowledge_job(uuid, text, text, text)
  to authenticated;

-- Worker and approval RPCs are server-only.
revoke all on function public.claim_knowledge_jobs(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.checkpoint_knowledge_job(uuid, uuid, uuid, text, text, text, timestamptz, text, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_knowledge_job(uuid, uuid, uuid, text, jsonb, smallint, jsonb, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.begin_knowledge_approval(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_knowledge_approval(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_knowledge_jobs(uuid, text, integer, integer) to service_role;
grant execute on function public.checkpoint_knowledge_job(uuid, uuid, uuid, text, text, text, timestamptz, text, text, integer) to service_role;
grant execute on function public.complete_knowledge_job(uuid, uuid, uuid, text, jsonb, smallint, jsonb, text, text) to service_role;
grant execute on function public.begin_knowledge_approval(uuid, uuid, text) to service_role;
grant execute on function public.complete_knowledge_approval(uuid, uuid, uuid, jsonb) to service_role;

-- Remove the user-unscoped legacy worker overloads. Conditional revokes keep a
-- confirmed postflight rerun idempotent. CASCADE is intentionally forbidden:
-- an unexpected dependency must abort and roll back the migration.
do $$
begin
  if to_regprocedure('public.claim_knowledge_jobs(text,integer,integer)') is not null then
    execute 'revoke all on function public.claim_knowledge_jobs(text, integer, integer) from public, anon, authenticated, service_role';
  end if;
  if to_regprocedure('public.checkpoint_knowledge_job(uuid,uuid,text,text,text,timestamptz,text,text,integer)') is not null then
    execute 'revoke all on function public.checkpoint_knowledge_job(uuid, uuid, text, text, text, timestamptz, text, text, integer) from public, anon, authenticated, service_role';
  end if;
  if to_regprocedure('public.complete_knowledge_job(uuid,uuid,text,jsonb,smallint,jsonb,text,text)') is not null then
    execute 'revoke all on function public.complete_knowledge_job(uuid, uuid, text, jsonb, smallint, jsonb, text, text) from public, anon, authenticated, service_role';
  end if;
end;
$$;
drop function if exists public.claim_knowledge_jobs(text, integer, integer);
drop function if exists public.checkpoint_knowledge_job(uuid, uuid, text, text, text, timestamptz, text, text, integer);
drop function if exists public.complete_knowledge_job(uuid, uuid, text, jsonb, smallint, jsonb, text, text);

notify pgrst, 'reload schema';

commit;
