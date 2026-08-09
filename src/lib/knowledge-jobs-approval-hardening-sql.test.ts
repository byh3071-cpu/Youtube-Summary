import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "016_knowledge_job_approval_cas_hardening.sql"),
  "utf8",
);
const preflight = readFileSync(
  join(process.cwd(), "docs", "supabase-migrations", "knowledge_workflow_preflight.sql"),
  "utf8",
);
const restVerifier = readFileSync(
  join(process.cwd(), "scripts", "verify-knowledge-supabase-rest.mjs"),
  "utf8",
);
const releaseVerifier = readFileSync(
  join(process.cwd(), "scripts", "verify-focus-feed.mjs"),
  "utf8",
);

describe("installed knowledge_jobs approval CAS hardening SQL contract", () => {
  it("replaces the existing worker RPC without modifying queued records", () => {
    expect(migration).toMatch(/create or replace function public\.complete_knowledge_job\(/i);
    expect(migration).not.toMatch(/\b(?:insert|delete|truncate)\s+(?:into\s+)?public\.knowledge_jobs\b/i);
    expect(migration).toContain("p_status not in ('review_required', 'action_required')");
    expect(migration).toContain("completed_at = null");
  });

  it("keeps the worker RPC service-role only and reloads the REST schema", () => {
    expect(migration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated, service_role/i);
    expect(migration).toContain("grant execute on function public.complete_knowledge_job(uuid, uuid, uuid, text, jsonb, smallint, jsonb, text, text)");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("provides pre-016 false and post-016 true evidence for the installed worker restriction", () => {
    expect(preflight).toContain("pg_get_functiondef(oid)");
    expect(preflight).toContain("if p_status not in (''review_required'', ''action_required'') then");
    expect(preflight).toContain("status = p_status");
    expect(preflight).toContain("completed_at = null");
    expect(preflight).toContain("status = ''completed''");
    expect(preflight).toContain("status = ''failed''");
    expect(preflight).toContain("as worker_restriction_hardened");
  });

  it("keeps required P0 RPC evidence separate from optional deferred P1 discovery", () => {
    expect(preflight).toContain("with required_p0(signature) as");
    expect(preflight).toContain("with optional_p1(signature) as");
    expect(preflight).toContain("with required_p0_worker(signature) as");
    expect(preflight).toContain("with optional_p1_worker(signature) as");
    expect(preflight).toContain("with required_p0_user_rpc(signature) as");
    expect(preflight).toContain("with optional_p1_user_rpc(signature) as");
    expect(preflight).toContain("014 intentionally does not install 013");
    expect(preflight).toContain("public.retry_knowledge_job(uuid,uuid)");
  });

  it("keeps the preflight script SELECT/WITH-only without dynamic SQL", () => {
    const statements = preflight
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    expect(statements).not.toHaveLength(0);
    expect(statements.every((statement) => /^(?:select|with)\b/i.test(statement))).toBe(true);
  });

  it("fails release verification when the P0 table, retry RPC, or knowledge postflight is missing", () => {
    expect(restVerifier).toContain('"retry_knowledge_job"');
    expect(restVerifier).toContain("&& knowledgeJobsExists");
    expect(restVerifier).toContain("missingP0Rpcs.length === 0");
    expect(restVerifier).toContain("serviceContractVerified: p0ContractVerified");
    expect(releaseVerifier).toContain(
      '["Knowledge Supabase contract", ["run", "verify:supabase:knowledge"]]',
    );
  });
});
