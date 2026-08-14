-- Rollback for 024. Disable KNOWLEDGE_CANARY_CAPTURE_ENABLED before applying.
-- Existing rows and reserved canary metadata are intentionally preserved.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

revoke all on function public.enqueue_knowledge_canary_job(uuid, text, text, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
drop function if exists public.enqueue_knowledge_canary_job(uuid, text, text, text, text, text, text, text, text);

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

revoke all on function public.enqueue_knowledge_job(text, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_knowledge_job(text, text, text, text, text, text, text, jsonb)
  to authenticated;

notify pgrst, 'reload schema';

commit;
