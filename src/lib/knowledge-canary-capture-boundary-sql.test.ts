import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "024_knowledge_canary_capture_boundary.sql"),
  "utf8",
);
const rollback = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "024_knowledge_canary_capture_boundary.rollback.sql"),
  "utf8",
);
const legacyUpgrade = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "014_knowledge_jobs_legacy_upgrade.sql"),
  "utf8",
);

function functionDefinition(sql: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sql.match(new RegExp(`create or replace function public\\.${escaped}[\\s\\S]*?\\n\\$\\$;`, "i"))?.[0]
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

describe("knowledge canary capture SQL boundary", () => {
  it("rejects the full reserved canary namespace from authenticated enqueue", () => {
    const standard = functionDefinition(migration, "enqueue_knowledge_job");
    expect(standard).toContain("jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) is distinct from 'object'");
    expect(standard).toContain("left(metadata_key.key_name, 8) = '_canary_'");
    expect(standard).toContain("coalesce(auth.role(), '') <> 'authenticated'");
  });

  it("creates one owner-scoped service-role RPC with no arbitrary metadata input", () => {
    const canary = functionDefinition(migration, "enqueue_knowledge_canary_job");
    expect(canary).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(canary).toContain("p_user_id uuid");
    expect(canary).toContain("p_run_id text");
    expect(canary).not.toContain("p_metadata");
    expect(canary).toContain("p_run_id !~ '^[0-9a-f]{64}$'");
    expect(canary).toContain("pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0))");
    expect(canary).toContain("set search_path = ''");
  });

  it("commits hold, no-retry, run identity, and capture readiness in the insert", () => {
    const canary = functionDefinition(migration, "enqueue_knowledge_canary_job");
    expect(canary).toMatch(/insert into public\.knowledge_jobs[\s\S]*metadata, capture_ready[\s\S]*'_canary_run_id', p_run_id[\s\S]*'_canary_hold', true[\s\S]*'_canary_no_retry', true[\s\S]*true\s*\)/i);
    expect(canary).toMatch(/where job\.user_id = p_user_id[\s\S]*job\.source_key = p_source_key[\s\S]*if found then[\s\S]*false/i);
  });

  it("keeps the dedicated RPC service-role-only and the normal RPC authenticated-only", () => {
    expect(migration).toMatch(/revoke all on function public\.enqueue_knowledge_canary_job[\s\S]*from public, anon, authenticated, service_role;[\s\S]*grant execute on function public\.enqueue_knowledge_canary_job[\s\S]*to service_role;/i);
    expect(migration).toMatch(/revoke all on function public\.enqueue_knowledge_job[\s\S]*from public, anon, authenticated, service_role;[\s\S]*grant execute on function public\.enqueue_knowledge_job[\s\S]*to authenticated;/i);
  });

  it("is generic, transactional, and ships a row-preserving rollback", () => {
    expect(migration).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    expect(migration).toMatch(/^--[\s\S]*\bbegin;[\s\S]*\bcommit;\s*$/i);
    expect(rollback).toContain("drop function if exists public.enqueue_knowledge_canary_job");
    expect(rollback).not.toMatch(/delete from|truncate table|update public\.knowledge_jobs/i);
    expect(functionDefinition(rollback, "enqueue_knowledge_job"))
      .toBe(functionDefinition(legacyUpgrade, "enqueue_knowledge_job"));
  });
});
