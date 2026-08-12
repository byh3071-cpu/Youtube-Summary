import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "docs",
    "supabase-migrations",
    "020_knowledge_public_caption_config_canary_recovery.sql",
  ),
  "utf8",
);
const preflight = readFileSync(
  join(process.cwd(), "scripts", "preflight-public-caption-canary-recovery.mjs"),
  "utf8",
);
const mutationBlock =
  migration.match(/update public\.knowledge_jobs as job\s+set([\s\S]*?)\s+where job\.id/i)?.[1] ?? "";

const approved = [
  [
    "e8264ecd-269d-42a8-b1ec-65998d87dd62",
    "0c65faf07d0ddff11d9b12bf74fa34c9949d05d64d9857f7b614bdc05e9a7a65",
    "QUALITY_GATE_FAILED",
  ],
  [
    "be6f59de-691d-4461-9f6e-3c765330056b",
    "196c2449575cf7a1948af4ab229f7664eff9143514c69a7440945645425a969d",
    "NLM_EVIDENCE_NOT_GROUNDED",
  ],
  [
    "63a4a8e4-503a-45fb-80a2-05d3a638df22",
    "22b24089a8e6263dec3fee2f0f6adfbf349e334503930882b4cb6446eac554e2",
    "QUALITY_GATE_FAILED",
  ],
];

describe("public caption config canary recovery SQL contract", () => {
  it("is service-role only and owner scoped", () => {
    expect(migration).toMatch(
      /function public\.recover_knowledge_public_caption_config_canary\(\s*p_user_id uuid,\s*p_job_id uuid/i,
    );
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toMatch(/job\.id = p_job_id\s+and job\.user_id = p_user_id/i);
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated, service_role/i);
    expect(migration).toContain(
      "grant execute on function public.recover_knowledge_public_caption_config_canary(uuid, uuid)",
    );
  });

  it("binds only the observed three failures and their current transcript hashes", () => {
    for (const row of approved) for (const value of row) expect(migration).toContain(`'${value}'`);
    expect(migration).toContain("approved.failure_code = job.failure_code");
    expect(migration).toContain("approved.failure_message = job.failure_message");
    expect(migration).toContain("approved.transcript_hash = lower(job.transcript_hash)");
    expect(migration).toContain("job.status = 'action_required'");
    expect(migration).toContain("job.attempt_count = 3");
    expect(migration).toContain("job.capture_ready = true");
  });

  it("requires the 019 marker and writes a distinct non-repeatable 020 marker", () => {
    expect(migration).toContain("jsonb_typeof(job.metadata -> '_semantic_json_fence_recovery_v1') = 'object'");
    expect(migration).toContain("'{_public_caption_config_recovery_v1}'");
    expect(migration).toMatch(/metadata ->> '_public_caption_config_recovery_v1'[\s\S]*= ''/i);
    expect(migration).toContain("'required_worker_config', 'KNOWLEDGE_ALLOW_EXTERNAL_TRANSCRIPT_FETCH=1'");
  });

  it("grants one claim without changing source identity or hashes", () => {
    expect(migration).toContain("status = 'queued'");
    expect(migration).toContain("attempt_count = 2");
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

  it("is a transactional function-only install", () => {
    expect(migration).toMatch(/\bbegin;[\s\S]*\bcommit;\s*$/i);
    expect(migration).toContain("set local lock_timeout = '5s'");
    expect(migration).toContain("set local statement_timeout = '30s'");
    expect(migration).toContain("notify pgrst, 'reload schema'");
    expect(migration).not.toMatch(/select\s+public\.recover_knowledge_public_caption_config_canary/i);
    expect(migration).not.toMatch(/\b(?:insert|delete|truncate)\s+(?:into\s+)?public\.knowledge_jobs\b/i);
  });

  it("ships a fixed-job read-only preflight", () => {
    for (const [jobId] of approved) expect(preflight).toContain(`id: "${jobId}"`);
    expect(preflight).toContain('.from("knowledge_jobs")');
    expect(preflight).toContain("readOnly: true");
    expect(preflight).toContain("eligible: true");
    expect(preflight).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/);
  });
});
