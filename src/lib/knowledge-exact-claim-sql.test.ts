import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "023_knowledge_exact_claim_and_no_retry_guard.sql"),
  "utf8",
);
const rollback = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "023_knowledge_exact_claim_and_no_retry_guard.rollback.sql"),
  "utf8",
);
const legacyUpgrade = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "014_knowledge_jobs_legacy_upgrade.sql"),
  "utf8",
);
const reviewInvalidation = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "018_knowledge_review_invalidation.sql"),
  "utf8",
);

function functionDefinition(sql: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sql.match(new RegExp(`create or replace function public\\.${escaped}[\\s\\S]*?\\n\\$\\$;`, "i"))?.[0]
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

describe("exact knowledge claim and no-retry SQL contract", () => {
  it("contains no job-specific UUID and never requeues a recovery target", () => {
    expect(migration).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    expect(migration).not.toMatch(/recover_knowledge_/i);
    expect(migration).not.toMatch(/attempt_count\s*=\s*2/i);
  });

  it("adds an owner-scoped atomic exact claim for service role only", () => {
    expect(migration).toMatch(/function public\.claim_knowledge_job_by_id\(\s*p_user_id uuid,\s*p_job_id uuid/i);
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toMatch(/job\.id = p_job_id\s+and job\.user_id = p_user_id/i);
    expect(migration).toMatch(/status = 'processing'[\s\S]*lease_token = gen_random_uuid\(\)[\s\S]*attempt_count = job\.attempt_count \+ 1/i);
    expect(migration).toMatch(/revoke all on function public\.claim_knowledge_job_by_id[\s\S]*from public, anon, authenticated, service_role/i);
    expect(migration).toMatch(/grant execute on function public\.claim_knowledge_job_by_id[\s\S]*to service_role/i);
  });

  it("keeps held canaries out of FIFO claims but permits exact queued claims", () => {
    const standard = migration.match(/create or replace function public\.claim_knowledge_jobs[\s\S]*?\n\$\$;/i)?.[0] ?? "";
    const exact = migration.match(/create or replace function public\.claim_knowledge_job_by_id[\s\S]*?\n\$\$;/i)?.[0] ?? "";
    expect(standard).toContain("coalesce(job.metadata ->> '_canary_hold', 'false') <> 'true'");
    expect(exact).not.toContain("coalesce(job.metadata ->> '_canary_hold', 'false') <> 'true'");
    expect(exact).toContain("and job.status = 'queued'");
  });

  it("terminates expired clean leases and blocks clean or recovered retries", () => {
    expect(migration).toContain("CANARY_LEASE_EXPIRED");
    expect(migration).toContain("LEASE_ATTEMPTS_EXHAUSTED");
    expect(migration).toContain("coalesce(job.metadata ->> '_canary_no_retry', 'false') <> 'true'");
    for (const marker of [
      "_legacy_review_recovery_v1",
      "_semantic_json_fence_recovery_v1",
      "_public_caption_config_recovery_v1",
      "_candidate_selection_format_recovery_v1",
      "_review_staging_conflict_recovery_v1",
    ]) expect(migration).toContain(`'${marker}'`);
  });

  it("is transactional and ships a non-destructive rollback", () => {
    expect(migration).toMatch(/^--[\s\S]*\bbegin;[\s\S]*\bcommit;\s*$/i);
    expect(rollback).toContain("drop function if exists public.claim_knowledge_job_by_id");
    expect(rollback).toContain("settle or explicitly release held canary rows");
    expect(rollback).toContain("max_attempts_exceeded");
    expect(rollback).not.toMatch(/delete from|truncate table/i);
  });

  it("restores the exact pre-023 claim and retry function definitions", () => {
    expect(functionDefinition(rollback, "claim_knowledge_jobs"))
      .toBe(functionDefinition(legacyUpgrade, "claim_knowledge_jobs"));
    expect(functionDefinition(rollback, "retry_knowledge_job"))
      .toBe(functionDefinition(reviewInvalidation, "retry_knowledge_job"));
  });
});
