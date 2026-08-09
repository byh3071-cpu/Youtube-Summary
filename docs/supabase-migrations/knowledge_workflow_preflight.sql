-- Focus Feed knowledge workflow: read-only preflight/postflight.
-- This file never creates, alters, grants, revokes, or drops database objects.
-- Run it before/after the P0 012/014/016 path. Migration 013 belongs to the
-- optional deferred P1 process-request workflow and is reported separately.

select
  to_regclass('public.knowledge_jobs') is not null as knowledge_jobs_exists,
  to_regclass('public.knowledge_process_requests') is not null as process_requests_exists;

with expected(column_name, udt_name, is_nullable) as (
  values
    ('approval_token', 'uuid', 'YES'),
    ('approval_started_at', 'timestamptz', 'YES'),
    ('approval_intent_hash', 'text', 'YES')
)
select
  expected.column_name,
  columns.column_name is not null as present,
  columns.udt_name,
  columns.is_nullable,
  columns.udt_name = expected.udt_name
    and columns.is_nullable = expected.is_nullable as contract_matches
from expected
left join information_schema.columns as columns
  on columns.table_schema = 'public'
 and columns.table_name = 'knowledge_jobs'
 and columns.column_name = expected.column_name
order by expected.column_name;

select
  con.conname,
  pg_get_constraintdef(con.oid, true) as definition,
  position('approving' in pg_get_constraintdef(con.oid, true)) > 0
    as allows_approving
from pg_constraint as con
where con.conrelid = to_regclass('public.knowledge_jobs')
  and con.contype = 'c'
  and position('status' in pg_get_constraintdef(con.oid, true)) > 0
order by con.conname;

select
  indexname,
  indexdef,
  indexdef like '%(user_id, status, lease_expires_at, created_at)%'
    as user_scoped_worker_queue
from pg_indexes
where schemaname = 'public'
  and tablename = 'knowledge_jobs'
  and indexname = 'idx_knowledge_jobs_worker_queue';

-- Required P0 RPC evidence. These functions are required whether or not the
-- deferred 013/P1 process-request workflow has been installed.
with required_p0(signature) as (
  values
    ('public.enqueue_knowledge_job(text,text,text,text,text,text,text,jsonb)'),
    ('public.enrich_knowledge_job(uuid,text,text,text)'),
    ('public.claim_knowledge_jobs(uuid,text,integer,integer)'),
    ('public.checkpoint_knowledge_job(uuid,uuid,uuid,text,text,text,timestamptz,text,text,integer)'),
    ('public.complete_knowledge_job(uuid,uuid,uuid,text,jsonb,smallint,jsonb,text,text)'),
    ('public.begin_knowledge_approval(uuid,uuid,text)'),
    ('public.complete_knowledge_approval(uuid,uuid,uuid,jsonb)'),
    ('public.retry_knowledge_job(uuid,uuid)')
)
select
  signature,
  to_regprocedure(signature) is not null as present
from required_p0
order by signature;

-- Optional/deferred P1 process-request discovery. Missing rows here do not
-- fail the required P0 contract above; 014 intentionally does not install 013.
with optional_p1(signature) as (
  values
    ('public.request_knowledge_processing(integer,uuid)'),
    ('public.claim_knowledge_process_request(uuid,text,integer)'),
    ('public.complete_knowledge_process_request(uuid,uuid,text,text,text)')
)
select
  signature,
  to_regprocedure(signature) is not null as present
from optional_p1
order by signature;

-- Required P0 worker RPC privileges.
with required_p0_worker(signature) as (
  values
    ('public.claim_knowledge_jobs(uuid,text,integer,integer)'),
    ('public.checkpoint_knowledge_job(uuid,uuid,uuid,text,text,text,timestamptz,text,text,integer)'),
    ('public.complete_knowledge_job(uuid,uuid,uuid,text,jsonb,smallint,jsonb,text,text)'),
    ('public.begin_knowledge_approval(uuid,uuid,text)'),
    ('public.complete_knowledge_approval(uuid,uuid,uuid,jsonb)'),
    ('public.retry_knowledge_job(uuid,uuid)')
), resolved as (
  select signature, to_regprocedure(signature) as oid
  from required_p0_worker
)
select
  signature,
  oid is not null as present,
  case when oid is null then null else has_function_privilege('anon', oid, 'EXECUTE') end as anon_can_execute,
  case when oid is null then null else has_function_privilege('authenticated', oid, 'EXECUTE') end as authenticated_can_execute,
  case when oid is null then null else has_function_privilege('service_role', oid, 'EXECUTE') end as service_role_can_execute
from resolved
order by signature;

-- Optional/deferred P1 process-request worker RPC privilege discovery.
with optional_p1_worker(signature) as (
  values
    ('public.claim_knowledge_process_request(uuid,text,integer)'),
    ('public.complete_knowledge_process_request(uuid,uuid,text,text,text)')
), resolved as (
  select signature, to_regprocedure(signature) as oid
  from optional_p1_worker
)
select
  signature,
  oid is not null as present,
  case when oid is null then null else has_function_privilege('anon', oid, 'EXECUTE') end as anon_can_execute,
  case when oid is null then null else has_function_privilege('authenticated', oid, 'EXECUTE') end as authenticated_can_execute,
  case when oid is null then null else has_function_privilege('service_role', oid, 'EXECUTE') end as service_role_can_execute
from resolved
order by signature;

-- Required P0 user RPC privileges.
with required_p0_user_rpc(signature) as (
  values
    ('public.enqueue_knowledge_job(text,text,text,text,text,text,text,jsonb)'),
    ('public.enrich_knowledge_job(uuid,text,text,text)')
), resolved as (
  select signature, to_regprocedure(signature) as oid
  from required_p0_user_rpc
)
select
  signature,
  oid is not null as present,
  case when oid is null then null else has_function_privilege('anon', oid, 'EXECUTE') end as anon_can_execute,
  case when oid is null then null else has_function_privilege('authenticated', oid, 'EXECUTE') end as authenticated_can_execute,
  case when oid is null then null else has_function_privilege('service_role', oid, 'EXECUTE') end as service_role_can_execute
from resolved
order by signature;

-- Optional/deferred P1 user RPC privilege discovery.
with optional_p1_user_rpc(signature) as (
  values
    ('public.request_knowledge_processing(integer,uuid)')
), resolved as (
  select signature, to_regprocedure(signature) as oid
  from optional_p1_user_rpc
)
select
  signature,
  oid is not null as present,
  case when oid is null then null else has_function_privilege('anon', oid, 'EXECUTE') end as anon_can_execute,
  case when oid is null then null else has_function_privilege('authenticated', oid, 'EXECUTE') end as authenticated_can_execute,
  case when oid is null then null else has_function_privilege('service_role', oid, 'EXECUTE') end as service_role_can_execute
from resolved
order by signature;

-- 016 approval hardening evidence for the exact installed worker RPC.
-- Before 016 on an affected installation, worker_restriction_hardened is false.
-- After 016, it is true only when workers can submit review_required or
-- action_required, while this RPC cannot publish completed or failed records.
with worker_rpc(signature, oid) as (
  values (
    'public.complete_knowledge_job(uuid,uuid,uuid,text,jsonb,smallint,jsonb,text,text)',
    to_regprocedure('public.complete_knowledge_job(uuid,uuid,uuid,text,jsonb,smallint,jsonb,text,text)')
  )
), function_source as (
  select
    signature,
    oid,
    case
      when oid is null then null
      else regexp_replace(lower(pg_get_functiondef(oid)), '\s+', ' ', 'g')
    end as normalized_definition
  from worker_rpc
), evidence as (
  select
    signature,
    oid,
    normalized_definition,
    position('if p_status not in (''review_required'', ''action_required'') then' in normalized_definition) > 0
      as only_review_or_action_accepted,
    position('status = p_status' in normalized_definition) > 0
      and position('completed_at = null' in normalized_definition) > 0
      as worker_clears_completion_state,
    position('status = ''completed''' in normalized_definition) = 0
      and position('status = ''failed''' in normalized_definition) = 0
      and position('execute ' in normalized_definition) = 0
      as no_terminal_publish_path
  from function_source
)
select
  signature,
  oid is not null as present,
  only_review_or_action_accepted,
  worker_clears_completion_state,
  no_terminal_publish_path,
  coalesce(
    only_review_or_action_accepted
      and worker_clears_completion_state
      and no_terminal_publish_path,
    false
  ) as worker_restriction_hardened
from evidence;

-- Any row here is an unexpected/legacy overload. In particular, a worker RPC
-- without the leading owner UUID must block rollout until a dedicated upgrade
-- migration revokes and removes it.
-- Expected P0 overloads only. Optional/deferred P1 overloads are discovered
-- separately below and cannot make this P0 legacy-overload check fail.
with expected_p0(oid) as (
  values
    (to_regprocedure('public.enqueue_knowledge_job(text,text,text,text,text,text,text,jsonb)')),
    (to_regprocedure('public.enrich_knowledge_job(uuid,text,text,text)')),
    (to_regprocedure('public.claim_knowledge_jobs(uuid,text,integer,integer)')),
    (to_regprocedure('public.checkpoint_knowledge_job(uuid,uuid,uuid,text,text,text,timestamptz,text,text,integer)')),
    (to_regprocedure('public.complete_knowledge_job(uuid,uuid,uuid,text,jsonb,smallint,jsonb,text,text)')),
    (to_regprocedure('public.begin_knowledge_approval(uuid,uuid,text)')),
    (to_regprocedure('public.complete_knowledge_approval(uuid,uuid,uuid,jsonb)'))
)
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  p.proacl as privileges
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'enqueue_knowledge_job',
    'enrich_knowledge_job',
    'claim_knowledge_jobs',
    'checkpoint_knowledge_job',
    'complete_knowledge_job',
    'begin_knowledge_approval',
    'complete_knowledge_approval'
  )
  and p.oid not in (select oid from expected_p0 where oid is not null)
order by p.proname, identity_arguments;

-- Optional/deferred P1 overload discovery. Inspect any returned rows when 013
-- is present, but an empty result is expected for a P0-only installation.
with expected_optional_p1(oid) as (
  values
    (to_regprocedure('public.request_knowledge_processing(integer,uuid)')),
    (to_regprocedure('public.claim_knowledge_process_request(uuid,text,integer)')),
    (to_regprocedure('public.complete_knowledge_process_request(uuid,uuid,text,text,text)'))
)
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  p.proacl as privileges
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'request_knowledge_processing',
    'claim_knowledge_process_request',
    'complete_knowledge_process_request'
  )
  and p.oid not in (select oid from expected_optional_p1 where oid is not null)
order by p.proname, identity_arguments;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('knowledge_jobs', 'knowledge_process_requests')
order by c.relname;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('knowledge_jobs', 'knowledge_process_requests')
order by tablename, policyname;

select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('knowledge_jobs', 'knowledge_process_requests')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- Required after 017: raw worker/private fields must not be readable through
-- the browser Supabase client. Focus Feed GET routes authenticate the cookie,
-- query with the server-only service role, and return an explicit allowlist.
select
  not has_table_privilege('anon', 'public.knowledge_jobs', 'select')
    as anon_direct_select_closed,
  not has_table_privilege('authenticated', 'public.knowledge_jobs', 'select')
    as authenticated_direct_select_closed,
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'knowledge_jobs'
      and policyname = 'knowledge_jobs_select_own'
  ) as legacy_select_policy_removed;

select
  role_name,
  has_schema_privilege(role_name, 'public', 'CREATE') as can_create_in_public
from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
order by role_name;

-- Any row here is an external database dependency that would make the safe
-- CASCADE-free legacy cleanup abort. Resolve it before applying 014.
with legacy(signature, oid) as (
  values
    ('public.claim_knowledge_jobs(text,integer,integer)',
      to_regprocedure('public.claim_knowledge_jobs(text,integer,integer)')::oid),
    ('public.checkpoint_knowledge_job(uuid,uuid,text,text,text,timestamptz,text,text,integer)',
      to_regprocedure('public.checkpoint_knowledge_job(uuid,uuid,text,text,text,timestamptz,text,text,integer)')::oid),
    ('public.complete_knowledge_job(uuid,uuid,text,jsonb,smallint,jsonb,text,text)',
      to_regprocedure('public.complete_knowledge_job(uuid,uuid,text,jsonb,smallint,jsonb,text,text)')::oid)
)
select
  legacy.signature,
  dependency.classid::regclass as dependent_catalog,
  dependency.objid as dependent_object_id,
  dependency.objsubid as dependent_subobject_id,
  dependency.deptype as dependency_type
from legacy
join pg_depend as dependency on dependency.refobjid = legacy.oid
where legacy.oid is not null
  and dependency.deptype not in ('i', 'e')
order by legacy.signature, dependent_catalog, dependent_object_id;
