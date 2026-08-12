import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const approvedJobIds = [
  "e8264ecd-269d-42a8-b1ec-65998d87dd62",
  "be6f59de-691d-4461-9f6e-3c765330056b",
  "63a4a8e4-503a-45fb-80a2-05d3a638df22",
];

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

loadLocalEnvironment();

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) fail("Supabase service-role environment is not configured.");

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const { data, error } = await supabase
  .from("knowledge_jobs")
  .select(
    "id,user_id,status,attempt_count,capture_ready,failure_code,failure_message,notebook_id,notebook_source_id,source_hash,transcript_hash,metadata",
  )
  .in("id", approvedJobIds)
  .order("id");

if (error) fail(`Canary preflight query failed: ${String(error.message).slice(0, 300)}`);
if (!Array.isArray(data) || data.length !== approvedJobIds.length) {
  fail(`Expected ${approvedJobIds.length} canaries but found ${data?.length ?? 0}.`);
}

const rowsById = new Map(data.map((row) => [row.id, row]));
const rows = approvedJobIds.map((id) => {
  const row = rowsById.get(id);
  if (!row) return null;
  const { metadata, ...visible } = row;
  return {
    ...visible,
    recovery_marker_present: Boolean(metadata?._semantic_json_fence_recovery_v1),
  };
});
if (rows.some((row) => !row)) fail("One or more approved canaries are missing.");

console.log(JSON.stringify({ ok: true, readOnly: true, rows }, null, 2));
