import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const expected = {
  id: "e8264ecd-269d-42a8-b1ec-65998d87dd62",
  user_id: "8a805f4a-ab4c-475b-8b62-728df86f5ae7",
  notebook_id: "dde61734-4133-412d-8d6f-e60b7a387c2f",
  notebook_source_id: "9eee7573-89e7-4ed2-ab8a-d8cfcfbb9c4e",
  source_hash: "a59856452f06e014e2d04659b7d17f4f1d045d53697f2deb447c4bf7c1a2c57d",
  transcript_hash: "9efe06cd63696e3161f7c57898737ee069f10549215f49ade314b6e35cb479ff",
  failure_code: "NLM_PROCESSING_FAILED",
  failure_message: "기존 검토 후보와 새 결과가 달라 덮어쓰지 않았습니다.",
};
const CASE_INSENSITIVE_FIELDS = new Set(["id", "user_id", "source_hash", "transcript_hash"]);

function loadLocalEnvironment() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, readOnly: true, error: message }, null, 2));
  process.exit(1);
}

function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function hasPrerequisiteRecoveryMarkers(metadata) {
  if (!isJsonObject(metadata)) return false;
  const legacy = metadata._legacy_review_recovery_v1;
  return (legacy === true || legacy === "true")
    && isJsonObject(metadata._semantic_json_fence_recovery_v1)
    && isJsonObject(metadata._public_caption_config_recovery_v1)
    && isJsonObject(metadata._candidate_selection_format_recovery_v1);
}

export function hasPriorStagingConflictRecoveryMarker(metadata) {
  if (!isJsonObject(metadata)) return false;
  const marker = metadata._review_staging_conflict_recovery_v1;
  return marker !== undefined && marker !== null && marker !== "";
}

export function matchesExpectedField(field, actual, expectedValue) {
  if (actual === undefined || actual === null) return false;
  const actualText = String(actual);
  return CASE_INSENSITIVE_FIELDS.has(field)
    ? actualText.toLowerCase() === expectedValue.toLowerCase()
    : actualText === expectedValue;
}

export function buildSafeSuccessRow(row) {
  return {
    target: "022-review-staging-conflict-canary",
    status: row.status,
    attempt_count: row.attempt_count,
    capture_ready: row.capture_ready,
    failure_code: row.failure_code,
    expected_identity_matches: true,
    expected_hashes_match: true,
    prerequisite_markers_present: true,
    staging_conflict_marker_present: false,
  };
}

async function fetchCanaryRow() {
  try {
    loadLocalEnvironment();
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) fail("Supabase service-role environment is not configured.");
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
      db: { timeout: 30_000 },
    });
    return await supabase
      .from("knowledge_jobs")
      .select("id,user_id,status,attempt_count,capture_ready,failure_code,failure_message,notebook_id,notebook_source_id,source_hash,transcript_hash,metadata")
      .eq("id", expected.id)
      .single();
  } catch {
    fail("Canary preflight setup or query failed.");
  }
}

async function main() {
  const { data: row, error } = await fetchCanaryRow();
  if (error) fail("Canary preflight query failed.");
  for (const [field, value] of Object.entries(expected)) {
    if (!matchesExpectedField(field, row?.[field], value)) fail(`Canary does not match ${field}.`);
  }
  if (row.status !== "action_required" || row.attempt_count !== 3 || row.capture_ready !== true) {
    fail("Canary is not in the exhausted action-required state.");
  }
  if (!hasPrerequisiteRecoveryMarkers(row.metadata)) fail("Canary is missing a prerequisite recovery marker.");
  if (hasPriorStagingConflictRecoveryMarker(row.metadata)) fail("Canary was already recovered by 022.");
  console.log(JSON.stringify({
    ok: true,
    readOnly: true,
    eligible: true,
    row: buildSafeSuccessRow(row),
  }, null, 2));
}

const invokedAsScript = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) await main();
