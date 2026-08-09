import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "docs",
    "supabase-migrations",
    "014_knowledge_jobs_legacy_upgrade.sql",
  ),
  "utf8",
);

describe("knowledge_jobs legacy upgrade SQL contract", () => {
  it("runs atomically without recreating or deleting the table", () => {
    expect(migration).toMatch(/\bbegin;[\s\S]*\bcommit;\s*$/i);
    expect(migration).toContain("set local lock_timeout = '5s'");
    expect(migration).toContain("set local statement_timeout = '60s'");
    expect(migration).not.toMatch(/\b(?:create|drop|truncate)\s+table\b/i);
    expect(migration).not.toMatch(/^\s*drop\s+function[^;]*\bcascade\b/im);
  });

  it("adds the approval columns and approving state without touching rows", () => {
    expect(migration).toContain("add column if not exists approval_token uuid");
    expect(migration).toContain(
      "add column if not exists approval_started_at timestamptz",
    );
    expect(migration).toContain(
      "add column if not exists approval_intent_hash text",
    );
    expect(migration).toMatch(
      /add constraint knowledge_jobs_status_check[\s\S]*'approving'[\s\S]*validate constraint knowledge_jobs_status_check/i,
    );
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.knowledge_jobs\b/i);
  });

  it("installs only the user-scoped worker and approval signatures", () => {
    expect(migration).toMatch(
      /function public\.claim_knowledge_jobs\(\s*p_user_id uuid/i,
    );
    expect(migration).toMatch(
      /function public\.checkpoint_knowledge_job\(\s*p_user_id uuid/i,
    );
    expect(migration).toMatch(
      /function public\.complete_knowledge_job\(\s*p_user_id uuid/i,
    );
    expect(migration).toMatch(
      /function public\.begin_knowledge_approval\(\s*p_user_id uuid/i,
    );
    expect(migration).toMatch(
      /function public\.complete_knowledge_approval\(\s*p_user_id uuid/i,
    );
  });

  it("upgraded worker completion cannot bypass the approval CAS to publish", () => {
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

  it("removes the three user-unscoped legacy overloads without CASCADE", () => {
    expect(migration).toContain(
      "drop function if exists public.claim_knowledge_jobs(text, integer, integer)",
    );
    expect(migration).toContain(
      "drop function if exists public.checkpoint_knowledge_job(uuid, uuid, text, text, text, timestamptz, text, text, integer)",
    );
    expect(migration).toContain(
      "drop function if exists public.complete_knowledge_job(uuid, uuid, text, jsonb, smallint, jsonb, text, text)",
    );
  });

  it("revokes inherited and explicit execution before granting least privilege", () => {
    expect(migration).toContain(
      "revoke all privileges on table public.knowledge_jobs from anon, authenticated",
    );
    expect(migration).not.toContain(
      "grant select on table public.knowledge_jobs to authenticated",
    );
    expect(migration).not.toContain('create policy "knowledge_jobs_select_own"');
    expect(migration).toMatch(
      /enqueue_knowledge_job\([\s\S]*from public, anon, authenticated, service_role;[\s\S]*enqueue_knowledge_job\([\s\S]*to authenticated;/i,
    );
    expect(migration).toMatch(
      /claim_knowledge_jobs\(uuid, text, integer, integer\)[\s\S]*from public, anon, authenticated, service_role;[\s\S]*claim_knowledge_jobs\(uuid, text, integer, integer\) to service_role;/i,
    );
  });

  it("restores the user-scoped worker queue index and reloads PostgREST", () => {
    expect(migration).toMatch(
      /idx_knowledge_jobs_worker_queue[\s\S]*\(user_id, status, lease_expires_at, created_at\)/i,
    );
    expect(migration).toContain("notify pgrst, 'reload schema'");
    expect(migration).not.toMatch(
      /^\s*(?:create|alter|drop|truncate)\s+table\s+public\.knowledge_process_requests/im,
    );
  });
});
