import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LOCKED_MIGRATIONS = Object.freeze({
  "019_knowledge_semantic_json_fence_canary_recovery.sql": "b450b1c5d2d016f096825ade5215fac33e202b2759d784ce83c47429ee1641dd",
  "020_knowledge_public_caption_config_canary_recovery.sql": "a5f820da2e3db516ac830eb987a4d55898a1a5e0cad42754ef63221b5d2f69ff",
  "021_knowledge_candidate_selection_canary_recovery.sql": "e6a797c4f811463e38217951857b53aaaac6a4367621b3692d07ab020bf70de5",
  "022_knowledge_review_staging_conflict_canary_recovery.sql": "436228c5e63f45e69293aee74ff1e7cfef5b9a1e7c7d8791f82512f85895914f",
});
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const MIGRATION_PATTERN = /^(\d{3})_.*\.sql$/i;
const KNOWLEDGE_JOB_REFERENCE = /\b(?:public\.)?[a-z0-9_]*knowledge_jobs?[a-z0-9_]*\b/i;

export function gitBlobSha256(bytes) {
  const normalized = Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  return createHash("sha256")
    .update(Buffer.from(`blob ${normalized.byteLength}\0`))
    .update(normalized)
    .digest("hex");
}

export function verifyKnowledgeMigrationGuard(directory) {
  const errors = [];
  for (const [name, expected] of Object.entries(LOCKED_MIGRATIONS)) {
    let bytes;
    try {
      bytes = readFileSync(join(directory, name));
    } catch {
      errors.push(`${name}: locked migration is missing`);
      continue;
    }
    if (gitBlobSha256(bytes) !== expected) errors.push(`${name}: locked Git-blob SHA-256 changed`);
  }

  for (const name of readdirSync(directory)) {
    const match = name.match(MIGRATION_PATTERN);
    if (!match || Number(match[1]) < 23) continue;
    const sql = readFileSync(join(directory, name), "utf8");
    if (KNOWLEDGE_JOB_REFERENCE.test(sql) && UUID_PATTERN.test(sql)) {
      errors.push(`${name}: job-specific UUID literal is forbidden after 022`);
    }
  }
  return errors;
}

const invokedAsScript = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const errors = verifyKnowledgeMigrationGuard(join(root, "docs", "supabase-migrations"));
  if (errors.length) {
    console.error(`[knowledge-migration-guard] FAIL\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("[knowledge-migration-guard] PASS");
  }
}
