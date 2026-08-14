import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "022_knowledge_review_staging_conflict_canary_recovery.sql"),
  "utf8",
);
const preflight = readFileSync(
  join(process.cwd(), "scripts", "preflight-review-staging-conflict-canary-recovery.mjs"),
  "utf8",
);
const preflightModuleUrl = pathToFileURL(
  join(process.cwd(), "scripts", "preflight-review-staging-conflict-canary-recovery.mjs"),
).href;
const mutationBlock = migration.match(/update public\.knowledge_jobs as job\s+set([\s\S]*?)\s+where job\.id/i)?.[1] ?? "";

describe("review staging conflict canary recovery SQL contract", () => {
  it("is service-role only and exact-owner scoped", () => {
    expect(migration).toMatch(/function public\.recover_knowledge_review_staging_conflict_canary\(\s*p_user_id uuid,\s*p_job_id uuid/i);
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toMatch(/job\.id = p_job_id\s+and job\.user_id = p_user_id/i);
    expect(migration).toContain("8a805f4a-ab4c-475b-8b62-728df86f5ae7");
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated, service_role/i);
  });

  it("binds the exact exhausted canary state and preserved source identity", () => {
    for (const value of [
      "e8264ecd-269d-42a8-b1ec-65998d87dd62",
      "dde61734-4133-412d-8d6f-e60b7a387c2f",
      "9eee7573-89e7-4ed2-ab8a-d8cfcfbb9c4e",
      "a59856452f06e014e2d04659b7d17f4f1d045d53697f2deb447c4bf7c1a2c57d",
      "9efe06cd63696e3161f7c57898737ee069f10549215f49ade314b6e35cb479ff",
      "NLM_PROCESSING_FAILED",
      "기존 검토 후보와 새 결과가 달라 덮어쓰지 않았습니다.",
    ]) expect(migration).toContain(`'${value}'`);
    expect(migration).toContain("job.status = 'action_required'");
    expect(migration).toContain("job.attempt_count = 3");
  });

  it("requires every prior recovery marker and writes exactly one new marker", () => {
    expect(migration).toContain("coalesce(job.metadata ->> '_legacy_review_recovery_v1', 'false') = 'true'");
    expect(migration).toContain("jsonb_typeof(job.metadata -> '_semantic_json_fence_recovery_v1') = 'object'");
    expect(migration).toContain("jsonb_typeof(job.metadata -> '_public_caption_config_recovery_v1') = 'object'");
    expect(migration).toContain("jsonb_typeof(job.metadata -> '_candidate_selection_format_recovery_v1') = 'object'");
    expect(migration).toContain("'{_review_staging_conflict_recovery_v1}'");
    expect(migration).toContain("'required_yohan_mcp_fix', 'ReviewStore invalidated-review archival'");
  });

  it("grants one bounded claim without changing source identity or hashes", () => {
    expect(migration).toContain("status = 'queued'");
    expect(migration).toContain("attempt_count = 2");
    expect(mutationBlock).not.toMatch(/notebook_(?:id|name|source_id|source_added_at)\s*=/i);
    expect(mutationBlock).not.toMatch(/(?:source_hash|transcript_hash)\s*=/i);
  });

  it("is a transactional function-only install", () => {
    expect(migration).toMatch(/\bbegin;[\s\S]*\bcommit;\s*$/i);
    expect(migration).toContain("set local lock_timeout = '5s'");
    expect(migration).toContain("set local statement_timeout = '30s'");
    expect(migration).not.toMatch(/select\s+public\.recover_knowledge_review_staging_conflict_canary/i);
  });

  it("ships a read-only exact-job preflight", () => {
    expect(preflight).toContain('id: "e8264ecd-269d-42a8-b1ec-65998d87dd62"');
    expect(preflight).toContain('.from("knowledge_jobs")');
    expect(preflight).toContain("readOnly: true");
    expect(preflight).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/);
  });

  it("mirrors the SQL prerequisite marker types", async () => {
    const { hasPrerequisiteRecoveryMarkers } = await import(preflightModuleUrl);
    const prerequisites = {
      _semantic_json_fence_recovery_v1: {},
      _public_caption_config_recovery_v1: {},
      _candidate_selection_format_recovery_v1: {},
    };
    expect(hasPrerequisiteRecoveryMarkers({ _legacy_review_recovery_v1: true, ...prerequisites })).toBe(true);
    expect(hasPrerequisiteRecoveryMarkers({ _legacy_review_recovery_v1: "true", ...prerequisites })).toBe(true);
    expect(hasPrerequisiteRecoveryMarkers({ _legacy_review_recovery_v1: false, ...prerequisites })).toBe(false);
    expect(hasPrerequisiteRecoveryMarkers({ _legacy_review_recovery_v1: 0, ...prerequisites })).toBe(false);
    expect(hasPrerequisiteRecoveryMarkers({
      _legacy_review_recovery_v1: true,
      ...prerequisites,
      _semantic_json_fence_recovery_v1: [],
    })).toBe(false);
    expect(hasPrerequisiteRecoveryMarkers({
      _legacy_review_recovery_v1: true,
      ...prerequisites,
      _public_caption_config_recovery_v1: "true",
    })).toBe(false);
  });

  it("mirrors the SQL prior-recovery marker predicate", async () => {
    const { hasPriorStagingConflictRecoveryMarker } = await import(preflightModuleUrl);
    expect(hasPriorStagingConflictRecoveryMarker({})).toBe(false);
    expect(hasPriorStagingConflictRecoveryMarker({ _review_staging_conflict_recovery_v1: null })).toBe(false);
    expect(hasPriorStagingConflictRecoveryMarker({ _review_staging_conflict_recovery_v1: "" })).toBe(false);
    expect(hasPriorStagingConflictRecoveryMarker({ _review_staging_conflict_recovery_v1: false })).toBe(true);
    expect(hasPriorStagingConflictRecoveryMarker({ _review_staging_conflict_recovery_v1: 0 })).toBe(true);
  });

  it("uses the same exact and case-insensitive comparisons as the SQL", async () => {
    const { matchesExpectedField } = await import(preflightModuleUrl);
    expect(matchesExpectedField("failure_code", "nlm_processing_failed", "NLM_PROCESSING_FAILED")).toBe(false);
    expect(matchesExpectedField("failure_code", "NLM_PROCESSING_FAILED", "NLM_PROCESSING_FAILED")).toBe(true);
    expect(matchesExpectedField("notebook_id", "ABC", "abc")).toBe(false);
    expect(matchesExpectedField("source_hash", "ABCDEF", "abcdef")).toBe(true);
    expect(matchesExpectedField("transcript_hash", "ABCDEF", "abcdef")).toBe(true);
    expect(matchesExpectedField("id", "ABCDEF00-0000-0000-0000-000000000000", "abcdef00-0000-0000-0000-000000000000")).toBe(true);
  });

  it("redacts production identifiers and hashes from routine success output", async () => {
    const { buildSafeSuccessRow } = await import(preflightModuleUrl);
    const sensitiveValues = ["owner-raw", "notebook-raw", "source-raw", "source-hash-raw", "transcript-hash-raw"];
    const safe = buildSafeSuccessRow({
      id: "job-raw",
      user_id: sensitiveValues[0],
      notebook_id: sensitiveValues[1],
      notebook_source_id: sensitiveValues[2],
      source_hash: sensitiveValues[3],
      transcript_hash: sensitiveValues[4],
      status: "action_required",
      attempt_count: 3,
      capture_ready: true,
      failure_code: "NLM_PROCESSING_FAILED",
    });
    const output = JSON.stringify(safe);
    for (const value of ["job-raw", ...sensitiveValues]) expect(output).not.toContain(value);
    expect(safe).toMatchObject({
      target: "022-review-staging-conflict-canary",
      expected_identity_matches: true,
      expected_hashes_match: true,
    });
  });

  it("routes setup and rejected query exceptions through structured failure", () => {
    expect(preflight).toMatch(/async function fetchCanaryRow\(\)\s*{\s*try\s*{/);
    expect(preflight).toMatch(/catch\s*{\s*fail\("Canary preflight setup or query failed\."\);/);
    expect(preflight).not.toMatch(/console\.(?:log|error)\([^\n]*(?:user_id|source_hash|transcript_hash)/);
  });
});
