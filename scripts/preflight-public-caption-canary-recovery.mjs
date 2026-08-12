import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const expected = [
  {
    id: "e8264ecd-269d-42a8-b1ec-65998d87dd62",
    failure_code: "QUALITY_GATE_FAILED",
    failure_message:
      "영상 시작·중간·끝 커버리지가 모두 필요합니다. 모든 사실 주장에는 타임스탬프 인용이 필요합니다.",
    notebook_id: "dde61734-4133-412d-8d6f-e60b7a387c2f",
    notebook_source_id: "9eee7573-89e7-4ed2-ab8a-d8cfcfbb9c4e",
    source_hash: "a59856452f06e014e2d04659b7d17f4f1d045d53697f2deb447c4bf7c1a2c57d",
    transcript_hash: "0c65faf07d0ddff11d9b12bf74fa34c9949d05d64d9857f7b614bdc05e9a7a65",
  },
  {
    id: "be6f59de-691d-4461-9f6e-3c765330056b",
    failure_code: "NLM_EVIDENCE_NOT_GROUNDED",
    failure_message: "NotebookLM source get 원문에 근거 문구가 없습니다.",
    notebook_id: "dde61734-4133-412d-8d6f-e60b7a387c2f",
    notebook_source_id: "5187e4ec-4232-4276-aff5-be0cb387688c",
    source_hash: "64804b07c4bd1b9048964412dbe8e10e36dacd8dbdf29464bf986dc36c0cbf62",
    transcript_hash: "196c2449575cf7a1948af4ab229f7664eff9143514c69a7440945645425a969d",
  },
  {
    id: "63a4a8e4-503a-45fb-80a2-05d3a638df22",
    failure_code: "QUALITY_GATE_FAILED",
    failure_message:
      "영상 시작·중간·끝 커버리지가 모두 필요합니다. 모든 사실 주장에는 타임스탬프 인용이 필요합니다.",
    notebook_id: "dde61734-4133-412d-8d6f-e60b7a387c2f",
    notebook_source_id: "4e185478-3cce-4387-97b5-e3d85d5dfa2c",
    source_hash: "e08441c396cf9029b4529e411e16ac74018a0aeba6ef0b59b5f80021928752ae",
    transcript_hash: "22b24089a8e6263dec3fee2f0f6adfbf349e334503930882b4cb6446eac554e2",
  },
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
  .in("id", expected.map((row) => row.id));
if (error) fail(`Canary preflight query failed: ${String(error.message).slice(0, 300)}`);
if (!Array.isArray(data) || data.length !== expected.length) {
  fail(`Expected ${expected.length} canaries but found ${data?.length ?? 0}.`);
}

const byId = new Map(data.map((row) => [row.id, row]));
const rows = expected.map((wanted) => {
  const row = byId.get(wanted.id);
  if (!row) fail(`Missing approved canary ${wanted.id}.`);
  for (const [key, value] of Object.entries(wanted)) {
    if (String(row[key] ?? "").toLowerCase() !== String(value).toLowerCase()) {
      fail(`Canary ${wanted.id} does not match ${key}.`);
    }
  }
  if (row.status !== "action_required" || row.attempt_count !== 3 || row.capture_ready !== true) {
    fail(`Canary ${wanted.id} is not in the exhausted action-required state.`);
  }
  if (!row.metadata?._semantic_json_fence_recovery_v1) {
    fail(`Canary ${wanted.id} is missing the 019 recovery marker.`);
  }
  if (row.metadata?._public_caption_config_recovery_v1) {
    fail(`Canary ${wanted.id} already has the 020 recovery marker.`);
  }
  return {
    id: row.id,
    user_id: row.user_id,
    status: row.status,
    attempt_count: row.attempt_count,
    capture_ready: row.capture_ready,
    failure_code: row.failure_code,
    notebook_id: row.notebook_id,
    notebook_source_id: row.notebook_source_id,
    source_hash: row.source_hash,
    transcript_hash: row.transcript_hash,
    semantic_recovery_marker_present: true,
    public_caption_recovery_marker_present: false,
  };
});

console.log(JSON.stringify({ ok: true, readOnly: true, eligible: true, rows }, null, 2));
