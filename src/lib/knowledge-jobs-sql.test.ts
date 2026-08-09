import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "012_knowledge_jobs.sql"),
  "utf8",
);

describe("knowledge_jobs worker lease SQL 계약", () => {
  it("전체 DDL을 한 transaction으로 적용하고 기존 partial table을 묵인하지 않는다", () => {
    expect(migration).toMatch(/\bbegin;[\s\S]*\bcommit;\s*$/i);
    expect(migration).toContain("create table public.knowledge_jobs");
    expect(migration).not.toContain("create table if not exists public.knowledge_jobs");
  });

  it("worker claim을 service_role과 최대 3개로 제한한다", () => {
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toMatch(/least\(coalesce\(p_limit,\s*3\),\s*3\)/);
    expect(migration).toMatch(/for update skip locked/i);
    expect(migration).toMatch(/function public\.claim_knowledge_jobs\(\s*p_user_id uuid/i);
    expect(migration).toMatch(/where user_id = p_user_id\s+and capture_ready = true/i);
    expect(migration).toMatch(/idx_knowledge_jobs_worker_queue[\s\S]*\(user_id, status, lease_expires_at, created_at\)/i);
  });

  it("대기 작업과 만료된 처리 작업만 다시 claim한다", () => {
    expect(migration).toMatch(/status = 'queued'/);
    expect(migration).toMatch(/status = 'processing' and lease_expires_at < now\(\)/);
    expect(migration).toContain("attempt_count = job.attempt_count + 1");
    expect(migration).toMatch(/where user_id = p_user_id\s+and capture_ready = true\s+and attempt_count < 3/);
    expect(migration).toContain("failure_code = 'max_attempts_exceeded'");
  });

  it("완료 전이는 처리 중 상태·같은 token·만료 전 lease를 모두 요구한다", () => {
    expect(migration).toMatch(/where id = p_job_id\s+and user_id = p_user_id\s+and status = 'processing'\s+and lease_token = p_lease_token/);
    expect(migration).toContain("and lease_expires_at > now()");
    expect(migration).toContain("job lease is no longer valid");
  });

  it("checkpoint는 현재 lease token으로만 NotebookLM 식별자·hash와 lease를 함께 갱신한다", () => {
    expect(migration).toContain("function public.checkpoint_knowledge_job");
    expect(migration).toContain("job.lease_token = p_lease_token");
    expect(migration).toContain("job.lease_expires_at > now()");
    expect(migration).toContain("notebook_source_id = coalesce(p_notebook_source_id, job.notebook_source_id)");
    expect(migration).toContain("lease_expires_at = now() + make_interval(secs => v_lease_seconds)");
    expect(migration).toContain("grant execute on function public.checkpoint_knowledge_job");
  });

  it("앱 사용자는 자기 작업 select·enqueue만 가능하고 table 직접 write는 닫는다", () => {
    expect(migration).not.toContain('create policy "knowledge_jobs_select_own"');
    expect(migration).toContain('create policy "knowledge_jobs_insert_own"');
    expect(migration).not.toMatch(/create policy "knowledge_jobs_(?:update|delete)_own"/);
    expect(migration).toContain("revoke all privileges on table public.knowledge_jobs from anon, authenticated");
    expect(migration).not.toMatch(/grant insert[\s\S]*to authenticated/);
    expect(migration).not.toContain("grant select on table public.knowledge_jobs to authenticated");
    expect(migration).toContain("grant execute on function public.enqueue_knowledge_job");
  });

  it("enqueue RPC는 로그인 사용자별로 직렬화하고 active·daily quota와 중복 반환을 보장한다", () => {
    expect(migration).toContain("coalesce(auth.role(), '') <> 'authenticated'");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0))");
    expect(migration).toContain("knowledge_queue_active_limit");
    expect(migration).toContain("knowledge_queue_daily_limit");
    expect(migration).toMatch(/where job\.user_id = v_user_id[\s\S]*job\.source_key = p_source_key/);
    expect(migration).toMatch(/v_job\.updated_at, v_job\.capture_ready, false/);
  });

  it("메타 보강 RPC는 로그인 사용자의 queued 예약을 원자적으로 처리 가능 상태로 만든다", () => {
    expect(migration).toContain("function public.enrich_knowledge_job");
    expect(migration).toContain("job.user_id = v_user_id");
    expect(migration).toContain("job.status = 'queued'");
    expect(migration).toContain("capture_ready = true");
    expect(migration).toContain("job.capture_ready = false");
    expect(migration).toContain("grant execute on function public.enrich_knowledge_job");
  });

  it("worker는 메타 보강이 끝난 작업만 claim한다", () => {
    expect(migration).toContain("capture_ready boolean not null default false");
    expect(migration).toMatch(/from public\.knowledge_jobs\s+where user_id = p_user_id\s+and capture_ready = true/);
  });

  it("worker RPC는 service_role 전용이다", () => {
    expect(migration).toContain("grant execute on function public.claim_knowledge_jobs");
    expect(migration).toContain("to service_role");
  });

  it("사람 승인은 원자 CAS token으로 review_required에서 approving을 거쳐 완료한다", () => {
    expect(migration).toContain("'approving'");
    expect(migration).toContain("function public.begin_knowledge_approval");
    expect(migration).toContain("for update");
    expect(migration).toContain("approval_token = gen_random_uuid()");
    expect(migration).toContain("approval_intent_hash is distinct from p_intent_hash");
    expect(migration).not.toContain("approval_human_note");
    expect(migration).toContain("function public.complete_knowledge_approval");
    expect(migration).toMatch(/status = 'approving'[\s\S]*approval_token = p_approval_token/);
    expect(migration).toContain("grant execute on function public.begin_knowledge_approval");
    expect(migration).toContain("grant execute on function public.complete_knowledge_approval");
    expect(migration).toMatch(/where id = p_job_id\s+and user_id = p_user_id\s+and status = 'approving'/);
  });

  it("worker 완료 RPC는 approval CAS를 우회해 completed 또는 failed로 전이할 수 없다", () => {
    const workerCompletion = migration.slice(
      migration.indexOf("create or replace function public.complete_knowledge_job"),
      migration.indexOf("create or replace function public.begin_knowledge_approval"),
    );

    expect(workerCompletion).toContain("p_status not in ('review_required', 'action_required')");
    expect(workerCompletion).toContain("completed_at = null");
    expect(workerCompletion).not.toContain("'completed'");
    expect(workerCompletion).not.toContain("'failed'");
    expect(migration).toMatch(/function public\.complete_knowledge_approval[\s\S]*status = 'completed'[\s\S]*status = 'approving'[\s\S]*approval_token = p_approval_token/);
  });

  it("RLS insert 방어선도 canonical YouTube 입력과 초기 worker 상태만 허용한다", () => {
    expect(migration).toContain("source_key = video_id");
    expect(migration).toContain("source_url = 'https://www.youtube.com/watch?v=' || video_id");
    expect(migration).toContain("tier = 'T2'");
    expect(migration).toContain("status = 'queued'");
    expect(migration).toContain("capture_ready = false");
    expect(migration).toContain("lease_token is null");
    expect(migration).toContain("attempt_count = 0");
    expect(migration).toContain("completed_at is null");
  });
});
