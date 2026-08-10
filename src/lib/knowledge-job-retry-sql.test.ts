import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "015_knowledge_job_retry.sql"),
  "utf8",
);
const invalidationMigration = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "018_knowledge_review_invalidation.sql"),
  "utf8",
);

function retryFailureCodes(sql: string): string[] {
  const start = sql.indexOf("create or replace function public.retry_knowledge_job");
  const end = sql.indexOf("revoke all on function public.retry_knowledge_job", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return [...sql.slice(start, end).matchAll(/'([A-Z][A-Z0-9_]+)'/g)].map((match) => match[1]);
}

describe("knowledge job retry SQL 계약", () => {
  it("service_role과 명시적 user/job 범위로만 원자 재처리한다", () => {
    expect(migration).toMatch(/function public\.retry_knowledge_job\(\s*p_user_id uuid,\s*p_job_id uuid/i);
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toMatch(/job\.id = p_job_id\s+and job\.user_id = p_user_id/i);
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated, service_role/i);
    expect(migration).toContain("grant execute on function public.retry_knowledge_job(uuid, uuid) to service_role");
  });

  it("action_required·허용된 실패·3회 미만만 queued로 되돌린다", () => {
    expect(migration).toContain("job.status = 'action_required'");
    expect(migration).toContain("job.attempt_count < 3");
    expect(migration).toContain("job.capture_ready = true");
    expect(migration).toContain("'NLM_EVIDENCE_NOT_GROUNDED'");
    expect(migration).toContain("'YTDLP_CAPTION_FETCH_FAILED'");
    expect(migration).toContain("raise exception 'job is not eligible for retry'");
  });

  it("018의 retry 계약은 015 허용 코드를 모두 보존하고 레거시 자막 복구 코드를 추가한다", () => {
    const originalCodes = retryFailureCodes(migration);
    const upgradedCodes = retryFailureCodes(invalidationMigration);

    for (const code of originalCodes) expect(upgradedCodes).toContain(code);
    expect(upgradedCodes).toContain("PUBLIC_CAPTION_TIMESTAMPS_REQUIRED");
    expect(invalidationMigration).toContain("job.capture_ready = true");
    expect(migration).toContain("운영 적용 순서는 반드시 015 → 018");
  });

  it("worker 산출물·lease·승인 상태만 비우고 source 식별자와 hash는 보존한다", () => {
    for (const field of [
      "result = '{}'::jsonb",
      "quality_score = null",
      "quality_report = '{}'::jsonb",
      "failure_code = null",
      "lease_token = null",
      "approval_token = null",
      "completed_at = null",
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).not.toMatch(/notebook_(?:id|name|source_id|source_added_at)\s*=/i);
    expect(migration).not.toMatch(/(?:source_hash|transcript_hash)\s*=/i);
    expect(migration).not.toMatch(/attempt_count\s*=/i);
  });
});
