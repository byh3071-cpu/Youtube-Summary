import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "021_knowledge_candidate_selection_canary_recovery.sql"),
  "utf8",
);
const preflight = readFileSync(
  join(process.cwd(), "scripts", "preflight-candidate-selection-canary-recovery.mjs"),
  "utf8",
);
const mutationBlock = migration.match(/update public\.knowledge_jobs as job\s+set([\s\S]*?)\s+where job\.id/i)?.[1] ?? "";

describe("candidate selection canary recovery SQL contract", () => {
  it("is service-role only and owner scoped", () => {
    expect(migration).toMatch(/function public\.recover_knowledge_candidate_selection_canary\(\s*p_user_id uuid,\s*p_job_id uuid/i);
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toMatch(/job\.id = p_job_id\s+and job\.user_id = p_user_id/i);
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated, service_role/i);
  });

  it("binds the exact observed first canary state", () => {
    for (const value of [
      "e8264ecd-269d-42a8-b1ec-65998d87dd62",
      "dde61734-4133-412d-8d6f-e60b7a387c2f",
      "9eee7573-89e7-4ed2-ab8a-d8cfcfbb9c4e",
      "a59856452f06e014e2d04659b7d17f4f1d045d53697f2deb447c4bf7c1a2c57d",
      "9efe06cd63696e3161f7c57898737ee069f10549215f49ade314b6e35cb479ff",
      "NLM_DRAFT_CONTRACT_INVALID",
      "NotebookLM 응답의 문자열 필드 길이가 올바르지 않습니다.",
    ]) expect(migration).toContain(`'${value}'`);
    expect(migration).not.toContain("be6f59de-691d-4461-9f6e-3c765330056b");
    expect(migration).not.toContain("63a4a8e4-503a-45fb-80a2-05d3a638df22");
  });

  it("requires both previous markers and writes one new marker", () => {
    expect(migration).toContain("jsonb_typeof(job.metadata -> '_semantic_json_fence_recovery_v1') = 'object'");
    expect(migration).toContain("jsonb_typeof(job.metadata -> '_public_caption_config_recovery_v1') = 'object'");
    expect(migration).toContain("'{_candidate_selection_format_recovery_v1}'");
    expect(migration).toContain("'required_yohan_mcp_fix', 'PR #69'");
  });

  it("grants one claim without changing source identity or hashes", () => {
    expect(migration).toContain("status = 'queued'");
    expect(migration).toContain("attempt_count = 2");
    expect(mutationBlock).not.toMatch(/notebook_(?:id|name|source_id|source_added_at)\s*=/i);
    expect(mutationBlock).not.toMatch(/(?:source_hash|transcript_hash)\s*=/i);
  });

  it("is a transactional function-only install", () => {
    expect(migration).toMatch(/\bbegin;[\s\S]*\bcommit;\s*$/i);
    expect(migration).toContain("set local lock_timeout = '5s'");
    expect(migration).toContain("set local statement_timeout = '30s'");
    expect(migration).not.toMatch(/select\s+public\.recover_knowledge_candidate_selection_canary/i);
  });

  it("ships a read-only exact-job preflight", () => {
    expect(preflight).toContain('id: "e8264ecd-269d-42a8-b1ec-65998d87dd62"');
    expect(preflight).toContain('.from("knowledge_jobs")');
    expect(preflight).toContain("readOnly: true");
    expect(preflight).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/);
  });
});
