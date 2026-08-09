import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "docs",
    "supabase-migrations",
    "017_knowledge_jobs_browser_read_hardening.sql",
  ),
  "utf8",
);
const preflight = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "knowledge_workflow_preflight.sql"),
  "utf8",
);

describe("knowledge_jobs browser read hardening SQL contract", () => {
  it("closes the legacy authenticated read surface without modifying rows", () => {
    expect(migration).toMatch(/\bbegin;[\s\S]*\bcommit;\s*$/i);
    expect(migration).toContain(
      'drop policy if exists "knowledge_jobs_select_own" on public.knowledge_jobs',
    );
    expect(migration).toContain(
      "revoke all privileges on table public.knowledge_jobs from anon, authenticated",
    );
    expect(migration).not.toMatch(
      /\b(?:insert|update|delete|truncate)\s+(?:into\s+)?public\.knowledge_jobs\b/i,
    );
    expect(migration).not.toMatch(/\b(?:create|alter|drop|truncate)\s+table\b/i);
  });

  it("reloads PostgREST and exposes read-only postflight evidence", () => {
    expect(migration).toContain("notify pgrst, 'reload schema'");
    expect(preflight).toContain("as authenticated_direct_select_closed");
    expect(preflight).toContain("as legacy_select_policy_removed");
  });
});
