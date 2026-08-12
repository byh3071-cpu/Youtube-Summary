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

const preflight = readFileSync(
  join(process.cwd(), "scripts", "preflight-semantic-canary-recovery.mjs"),
  "utf8",
);

const mutationBlock = migration.match(/update public\.knowledge_jobs as job\s+set([\s\S]*?)\s+where job\.id/i)?.[1] ?? "";

const approvedCanaries = [
  [
    "e8264ecd-269d-42a8-b1ec-65998d87dd62",
    "dde61734-4133-412d-8d6f-e60b7a387c2f",
    "9eee7573-89e7-4ed2-ab8a-d8cfcfbb9c4e",
    "a59856452f06e014e2d04659b7d17f4f1d045d53697f2deb447c4bf7c1a2c57d",
    "9efe06cd63696e3161f7c57898737ee069f10549215f49ade314b6e35cb479ff",
  ],
  [
    "be6f59de-691d-4461-9f6e-3c765330056b",
    "dde61734-4133-412d-8d6f-e60b7a387c2f",
    "5187e4ec-4232-4276-aff5-be0cb387688c",
    "64804b07c4bd1b9048964412dbe8e10e36dacd8dbdf29464bf986dc36c0cbf62",
    "49d3f4144104c976218733f69cf24af8022c55890bbc956569dd8173f30175d7",
  ],
  [
    "63a4a8e4-503a-45fb-80a2-05d3a638df22",
    "dde61734-4133-412d-8d6f-e60b7a387c2f",
    "4e185478-3cce-4387-97b5-e3d85d5dfa2c",
    "e08441c396cf9029b4529e411e16ac74018a0aeba6ef0b59b5f80021928752ae",
    "6cbe62d8ca806bca3f5b252507d8a86a935825f9106653499559b87815bb7c99",
  ],
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
    for (const canary of approvedCanaries) {
      for (const value of canary) expect(migration).toContain(`'${value}'`);
    }
    expect(migration).toMatch(/approved\.job_id = job\.id/i);
    expect(migration).toMatch(/approved\.notebook_id = job\.notebook_id/i);
    expect(migration).toMatch(/approved\.notebook_source_id = job\.notebook_source_id/i);
    expect(migration).toMatch(/approved\.source_hash = lower\(job\.source_hash\)/i);
    expect(migration).toMatch(/approved\.transcript_hash = lower\(job\.transcript_hash\)/i);
  });

  it("requires the exact exhausted failure and complete preserved source identity", () => {
    expect(migration).toContain("job.status = 'action_required'");
    expect(migration).toContain("job.attempt_count = 3");
    expect(migration).toContain("job.failure_code = 'NLM_EVIDENCE_NOT_SUPPORTED'");
    expect(migration).toContain(
      "job.failure_message = 'Semantic evaluator returned malformed JSON.'",
    );
    expect(migration).toContain("as approved(job_id, notebook_id, notebook_source_id, source_hash, transcript_hash)");
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
    expect(mutationBlock).not.toMatch(/notebook_(?:id|name|source_id|source_added_at)\s*=/i);
    expect(mutationBlock).not.toMatch(/(?:source_hash|transcript_hash)\s*=/i);
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

  it("ships a fixed-job read-only preflight without mutation methods", () => {
    for (const [jobId] of approvedCanaries) expect(preflight).toContain(`"${jobId}"`);
    expect(preflight).toContain('.from("knowledge_jobs")');
    expect(preflight).toContain('.in("id", approvedJobIds)');
    expect(preflight).toContain("readOnly: true");
    expect(preflight).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/);
    expect(preflight).not.toContain("SUPABASE_SERVICE_ROLE_KEY}");
  });
});
