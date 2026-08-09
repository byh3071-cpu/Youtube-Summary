import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "018_knowledge_review_invalidation.sql"),
  "utf8",
);

describe("legacy knowledge review invalidation SQL contract", () => {
  it("is service-role only and scopes every mutation to owner plus job", () => {
    expect(migration).toMatch(/function public\.invalidate_knowledge_review\(\s*p_user_id uuid,\s*p_job_id uuid/i);
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toMatch(/job\.id = p_job_id\s+and job\.user_id = p_user_id/i);
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated, service_role/i);
    expect(migration).toContain("grant execute on function public.invalidate_knowledge_review(uuid, uuid) to service_role");
  });

  it("only invalidates retryable review rows with a fixed failure reason", () => {
    expect(migration).toContain("job.status = 'review_required'");
    expect(migration).toContain("job.capture_ready = true");
    expect(migration).toContain("job.attempt_count <= 3");
    expect(migration).toContain("attempt_count = case when job.attempt_count = 3 then 2 else job.attempt_count end");
    expect(migration).toContain("'{_legacy_review_recovery_v1}'");
    expect(migration).toMatch(/metadata ->> '_legacy_review_recovery_v1'[\s\S]*<> 'true'/i);
    expect(migration).toContain("failure_code = 'PUBLIC_CAPTION_TIMESTAMPS_REQUIRED'");
    expect(migration).toContain("raise exception 'knowledge review is not eligible for invalidation'");
  });

  it("preserves source identity, hashes, and audit payload until retry", () => {
    const invalidationBody = migration.split("create or replace function public.retry_knowledge_job", 1)[0] ?? "";
    expect(invalidationBody).not.toMatch(/notebook_(?:id|name|source_id|source_added_at)\s*=/i);
    expect(invalidationBody).not.toMatch(/(?:source_hash|transcript_hash)\s*=/i);
    expect(invalidationBody).not.toMatch(/(?:result|quality_score|quality_report)\s*=/i);
  });

  it("records a one-time recovery marker so attempt three cannot loop", () => {
    const invalidationBody = migration.split("create or replace function public.retry_knowledge_job", 1)[0] ?? "";
    expect(invalidationBody.match(/_legacy_review_recovery_v1/g)).toHaveLength(2);
    expect(invalidationBody).toContain("attempt_count = case when job.attempt_count = 3 then 2 else job.attempt_count end");
  });

  it("upgrades installed retry RPC to accept only the fixed new reason", () => {
    expect(migration).toContain("'PUBLIC_CAPTION_TIMESTAMPS_REQUIRED'");
    expect(migration).toMatch(/job\.status = 'action_required'[\s\S]*job\.attempt_count < 3/i);
    expect(migration).toContain("result = '{}'::jsonb");
    expect(migration).toContain("quality_report = '{}'::jsonb");
  });
});
