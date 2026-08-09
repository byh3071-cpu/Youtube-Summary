-- 012: Focus Feed → yohan-brain 지식 처리 대기열
--
-- 이 파일은 "실행 가능한 설계"다. 운영 Supabase에 자동 적용하지 않는다.
-- 적용 전: SQL Editor에서 검토하고, P0 canary 환경에서 한 건을 먼저 검증한다.

begin;

create extension if not exists pgcrypto;

-- 이미 같은 이름의 table이 있으면 부분 스키마를 묵인하지 않고 전체 transaction을 실패시킨다.
create table public.knowledge_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('youtube')),
  source_key text not null, -- YouTube video ID. 사용자별 멱등 키의 일부다.
  source_url text not null check (source_url ~ '^https://'),
  video_id text not null,
  title text not null,
  channel_name text,
  source_guide text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  capture_ready boolean not null default false,
  tier text not null default 'T2' check (tier in ('T1', 'T2', 'T3')),
  status text not null default 'queued' check (status in (
    'queued', 'processing', 'review_required', 'approving', 'completed',
    'action_required', 'failed', 'cancelled'
  )),
  source_hash text,
  transcript_hash text,
  notebook_id text,
  notebook_name text,
  notebook_source_id text,
  notebook_source_added_at timestamptz,
  quality_score smallint check (quality_score between 0 and 100),
  quality_report jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  failure_code text,
  failure_message text,
  approval_token uuid,
  approval_started_at timestamptz,
  approval_intent_hash text,
  lease_token uuid,
  lease_owner text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, source_type, source_key)
);

create index if not exists idx_knowledge_jobs_worker_queue
  on public.knowledge_jobs (user_id, status, lease_expires_at, created_at);
create index if not exists idx_knowledge_jobs_user_status
  on public.knowledge_jobs (user_id, status, created_at desc);

create or replace function public.touch_knowledge_jobs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knowledge_jobs_touch_updated_at on public.knowledge_jobs;
create trigger knowledge_jobs_touch_updated_at
before update on public.knowledge_jobs
for each row execute function public.touch_knowledge_jobs_updated_at();

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

-- RLS가 막지 않는 TRUNCATE까지 제거한다. 브라우저에는 원본 테이블을 열지 않고,
-- 서버 route가 service role로 소유자 조건과 응답 allowlist를 강제한다.
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

  -- 같은 사용자의 동시 enqueue를 직렬화해 중복·quota 경쟁을 막는다.
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

revoke all on function public.enqueue_knowledge_job(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.enqueue_knowledge_job(text, text, text, text, text, text, text, jsonb) to authenticated;

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

revoke all on function public.enrich_knowledge_job(uuid, text, text, text) from public;
grant execute on function public.enrich_knowledge_job(uuid, text, text, text) to authenticated;

-- 상태 전이는 서버 worker만 담당한다. 앱은 API를 통해 새 작업만 접수한다.

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

  -- 세 번 모두 worker crash로 lease가 만료된 poison job은 자동 재선점하지 않는다.
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
  -- A worker may prepare a review or request action, but it must never
  -- publish directly. Only complete_knowledge_approval can move a job to
  -- completed after begin_knowledge_approval owns the CAS token.
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

-- 사람 승인 한 건의 소유권과 승인 메모를 원자적으로 고정한다. 승인 중 crash가
-- 나면 같은 intent만 이어서 RESOURCE/SUMMARY pair를 복구할 수 있다.
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

revoke all on function public.claim_knowledge_jobs(uuid, text, integer, integer) from public;
revoke all on function public.checkpoint_knowledge_job(uuid, uuid, uuid, text, text, text, timestamptz, text, text, integer) from public;
revoke all on function public.complete_knowledge_job(uuid, uuid, uuid, text, jsonb, smallint, jsonb, text, text) from public;
revoke all on function public.begin_knowledge_approval(uuid, uuid, text) from public;
revoke all on function public.complete_knowledge_approval(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.claim_knowledge_jobs(uuid, text, integer, integer) to service_role;
grant execute on function public.checkpoint_knowledge_job(uuid, uuid, uuid, text, text, text, timestamptz, text, text, integer) to service_role;
grant execute on function public.complete_knowledge_job(uuid, uuid, uuid, text, jsonb, smallint, jsonb, text, text) to service_role;
grant execute on function public.begin_knowledge_approval(uuid, uuid, text) to service_role;
grant execute on function public.complete_knowledge_approval(uuid, uuid, uuid, jsonb) to service_role;

commit;
