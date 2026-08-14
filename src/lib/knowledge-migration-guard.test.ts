import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts", "verify-knowledge-migration-guard.mjs");

function runGuardFixture(files: Record<string, string>): string[] {
  const root = mkdtempSync(join(tmpdir(), "knowledge-migration-guard-"));
  const migrations = join(root, "docs", "supabase-migrations");
  mkdirSync(migrations, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(migrations, name), content, "utf8");
  const source = `import { verifyKnowledgeMigrationGuard } from ${JSON.stringify(pathToFileURL(script).href)};\nconsole.log(JSON.stringify(verifyKnowledgeMigrationGuard(${JSON.stringify(migrations)})));`;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", source], { encoding: "utf8" })) as string[];
}

describe("knowledge migration guard", () => {
  it("passes against the repository migration set", async () => {
    const { verifyKnowledgeMigrationGuard } = await import(pathToFileURL(script).href);
    expect(verifyKnowledgeMigrationGuard(join(process.cwd(), "docs", "supabase-migrations"))).toEqual([]);
  });

  it("fails closed when a locked recovery migration is missing or changed", () => {
    const errors = runGuardFixture({
      "019_knowledge_semantic_json_fence_canary_recovery.sql": "changed",
    });
    expect(errors).toContain("019_knowledge_semantic_json_fence_canary_recovery.sql: locked Git-blob SHA-256 changed");
    expect(errors).toContain("022_knowledge_review_staging_conflict_canary_recovery.sql: locked migration is missing");
  });

  it("rejects job-specific UUID literals in knowledge migrations after 022", () => {
    const errors = runGuardFixture({
      "023_generic.sql": "update public.knowledge_jobs set status = 'queued' where id = 'e8264ecd-269d-42a8-b1ec-65998d87dd62'::uuid;",
    });
    expect(errors).toContain("023_generic.sql: job-specific UUID literal is forbidden after 022");

    const indirectErrors = runGuardFixture({
      "024_indirect.sql": "select public.retry_knowledge_job('00000000-0000-0000-0000-000000000000'::uuid, 'e8264ecd-269d-42a8-b1ec-65998d87dd62'::uuid);",
    });
    expect(indirectErrors).toContain("024_indirect.sql: job-specific UUID literal is forbidden after 022");
  });
});
