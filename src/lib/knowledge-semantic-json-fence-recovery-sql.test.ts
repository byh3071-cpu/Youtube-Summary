import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "docs",
    "supabase-migrations",
    "019_knowledge_semantic_json_fence_canary_recovery.sql",
  ),
  "utf8",
);

const approvedJobIds = [
  "e8264ecd-269d-42a8-b1ec-65998d87dd62",
  "be6f59de-691d-4461-9f6e-3c765330056b",
  "63a4a8e4-503a-45fb-80a2-05d3a638df22",
];

describe("semantic JSON fence canary recovery SQL contract", () => {
  it("is service-role only and scopes every mutation to owner plus job", () => {
    expect(migration).toMatch(
      /function public\.recover_knowledge_semantic_json_fence_canary\(\s*p_user_id uuid,\s*p_job_id uuid/i,
    );
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toMatch(/job\.id = p_job_id\s+and job\.user_id = p_user_id/i);
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated, service_role/i);
    expect(migration).toContain(
      "grant execute on function public.recover_knowledge_semantic_json_fence_canary(uuid, uuid)",
    );
  });

  it("can target only the three explicitly approved canaries", () => {
    for (const jobId of approvedJobIds) expect(migration).toContain(`'${jobId}'::uuid`);
    expect(migration.match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/gi)).toHaveLength(3);
    expect(migration).toMatch(/job\.id in \([\s\S]*?\)\s+and job\.capture_ready = true/i);
  });

  it("requires the exact exhausted failure and complete preserved source identity", () => {
    expect(migration).toContain("job.status = 'action_required'");
    expect(migration).toContain("job.attempt_count = 3");
    expect(migration).toContain("job.failure_code = 'NLM_EVIDENCE_NOT_SUPPORTED'");
    expect(migration).toContain(
      "job.failure_message = 'Semantic evaluator returned malformed JSON.'",
    );
    expect(migration).toContain("nullif(trim(job.notebook_id), '') is not null");
    expect(migration).toContain("nullif(trim(job.notebook_source_id), '') is not null");
    expect(migration).toContain("job.source_hash ~ '^[0-9a-fA-F]{64}$'");
    expect(migration).toContain("job.transcript_hash ~ '^[0-9a-fA-F]{64}$'");
  });

  it("grants one final claim and records a non-repeatable audit marker", () => {
    expect(migration).toContain("status = 'queued'");
    expect(migration).toContain("attempt_count = 2");
    expect(migration).toContain("'{_semantic_json_fence_recovery_v1}'");
    expect(migration).toMatch(
      /metadata ->> '_semantic_json_fence_recovery_v1'[\s\S]*= ''/i,
    );
    expect(migration).toContain("'previous_attempt_count', job.attempt_count");
    expect(migration).toContain("'previous_failure_code', job.failure_code");
    expect(migration).toContain(
      "raise exception 'semantic JSON fence canary is not eligible for recovery'",
    );
  });

  it("clears only worker output and lease state while preserving source identity and hashes", () => {
    for (const field of [
      "result = '{}'::jsonb",
      "quality_score = null",
      "quality_report = '{}'::jsonb",
      "failure_code = null",
      "failure_message = null",
      "approval_token = null",
      "lease_token = null",
      "completed_at = null",
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).not.toMatch(/notebook_(?:id|name|source_id|source_added_at)\s*=/i);
    expect(migration).not.toMatch(/(?:source_hash|transcript_hash)\s*=/i);
  });

  it("is a transactional, function-only install with bounded DDL locks", () => {
    expect(migration).toMatch(/\bbegin;[\s\S]*\bcommit;\s*$/i);
    expect(migration).toContain("set local lock_timeout = '5s'");
    expect(migration).toContain("set local statement_timeout = '30s'");
    expect(migration).toContain("notify pgrst, 'reload schema'");
    expect(migration).not.toMatch(/\b(?:insert|delete|truncate)\s+(?:into\s+)?public\.knowledge_jobs\b/i);
    expect(migration).not.toMatch(/select\s+public\.recover_knowledge_semantic_json_fence_canary/i);
    expect(migration).not.toContain("create or replace function public.retry_knowledge_job");
  });
});
