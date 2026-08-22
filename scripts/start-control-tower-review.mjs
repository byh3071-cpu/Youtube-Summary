import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CONTROL_TOWER_ROOT = "C:/Users/Public/dev/yohan-ecosystem/yohan-control-tower";
const YOHAN_MCP_ROOT = "C:/Users/Public/dev/yohan-ecosystem/yohan-mcp";
const YOHAN_BRAIN_ROOT = "C:/Users/Public/dev/yohan-ecosystem/yohan-brain";
const EXPECTED_YOHAN_HEAD = "afbe10b1b58649257ac82ba34f6c0f583a5cfd74";

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

function loadEnvironment(path) {
  if (!existsSync(path)) fail("Focus Feed local environment file is missing.");
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

const focusEnv = loadEnvironment(resolve(process.cwd(), ".env.local"));
const supabaseUrl = focusEnv.SUPABASE_URL ?? focusEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = focusEnv.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) fail("Focus Feed Supabase service-role configuration is missing.");

const git = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: YOHAN_MCP_ROOT,
  encoding: "utf8",
  windowsHide: true,
  shell: false,
});
if (git.status !== 0 || git.stdout.trim() !== EXPECTED_YOHAN_HEAD) {
  fail("yohan-mcp is not pinned to the reviewed PR #69 merge commit.");
}

const nextCli = join(CONTROL_TOWER_ROOT, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextCli)) fail("Control Tower Next.js CLI is missing. Run npm install first.");
const logDir = join(CONTROL_TOWER_ROOT, "logs");
mkdirSync(logDir, { recursive: true });
const stdout = openSync(join(logDir, "knowledge-review-dev.out.log"), "a");
const stderr = openSync(join(logDir, "knowledge-review-dev.err.log"), "a");

let child;
try {
  child = spawn(process.execPath, [nextCli, "dev", "-H", "127.0.0.1", "-p", "3001"], {
    cwd: CONTROL_TOWER_ROOT,
    env: {
      ...process.env,
      YOHAN_OS_ROOT: YOHAN_BRAIN_ROOT,
      YOHAN_MCP_ROOT,
      YOHAN_BRAIN_ROOT,
      FOCUS_FEED_SUPABASE_URL: supabaseUrl,
      FOCUS_FEED_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      FOCUS_FEED_OWNER_USER_ID: "8a805f4a-ab4c-475b-8b62-728df86f5ae7",
    },
    windowsHide: true,
    shell: false,
    stdio: ["ignore", stdout, stderr],
  });
} finally {
  closeSync(stdout);
  closeSync(stderr);
}

console.log(JSON.stringify({
  ok: true,
  pid: child.pid,
  url: "http://127.0.0.1:3001/#knowledge-review",
  secretsPrinted: false,
}, null, 2));

child.once("error", (error) => fail(`Control Tower failed to start: ${error.message}`));
child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
