import { createHash } from "node:crypto";
import { cookies } from "next/headers";

import { normalizeYouTubeUrl } from "@/lib/knowledge-capture";
import {
  enqueueKnowledgeCanaryCapture,
  type KnowledgeCaptureFailureCode,
} from "@/lib/knowledge-capture-server";
import { takeToken } from "@/lib/rate-limit";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_384;
const OWNER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CanaryItem = { url?: unknown; title?: unknown; channelName?: unknown };

const CANARY_ERROR_MESSAGES: Record<KnowledgeCaptureFailureCode, string> = {
  NORMALIZATION_FAILED: "카나리 캡처 입력을 정규화하지 못했습니다.",
  QUEUE_UNAVAILABLE: "지식 대기열을 일시적으로 사용할 수 없습니다.",
  QUEUE_LIMIT: "지식 대기열 한도에 도달했습니다.",
  ENQUEUE_FAILED: "지식 대기열 접수에 실패했습니다.",
  EMPTY_RESPONSE: "지식 대기열 응답을 확인하지 못했습니다.",
  ENRICH_METADATA_FAILED: "영상은 접수했지만 처리 준비 정보를 만들지 못했습니다.",
  ENRICH_UNAVAILABLE: "영상은 접수했지만 처리 준비를 마치지 못했습니다.",
  ENRICH_FAILED: "영상은 접수했지만 처리 준비를 마치지 못했습니다.",
  ENRICH_EMPTY: "접수 작업의 처리 준비 상태를 확인하지 못했습니다.",
};

function json(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store");
  return Response.json(body, { ...init, headers });
}

function requiredBoundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function optionalBoundedString(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function requestTooLarge(request: Request): boolean {
  const contentLength = request.headers.get("content-length");
  return contentLength !== null && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_BODY_BYTES;
}

function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readBodyWithinLimit(request: Request): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RangeError("body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

export async function POST(request: Request) {
  if (process.env.KNOWLEDGE_CANARY_CAPTURE_ENABLED !== "1") {
    return json({ error: "카나리 캡처가 비활성화되어 있습니다." }, { status: 404 });
  }

  const ownerId = process.env.KNOWLEDGE_CANARY_OWNER_USER_ID?.trim() ?? "";
  if (!OWNER_ID_PATTERN.test(ownerId)) {
    return json({ error: "카나리 캡처 owner 설정을 확인해 주세요." }, { status: 503 });
  }
  if (!hasTrustedOrigin(request)) {
    return json({ error: "허용되지 않은 요청 출처입니다." }, { status: 403 });
  }

  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.id.toLowerCase() !== ownerId.toLowerCase()) {
    return json({ error: "카나리 캡처 권한이 없습니다." }, { status: 403 });
  }
  if (requestTooLarge(request)) {
    return json({ error: "요청 본문은 16KiB 이하여야 합니다." }, { status: 413 });
  }

  let raw = "";
  try {
    raw = await readBodyWithinLimit(request);
  } catch (error) {
    if (error instanceof RangeError) {
      return json({ error: "요청 본문은 16KiB 이하여야 합니다." }, { status: 413 });
    }
    return json({ error: "요청 본문을 읽지 못했습니다." }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: "올바른 JSON 요청이 아닙니다." }, { status: 400 });
  }
  const items = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as { items?: unknown }).items
    : null;
  if (!Array.isArray(items) || items.length < 1 || items.length > 7) {
    return json({ error: "items는 1개 이상 7개 이하이어야 합니다." }, { status: 400 });
  }

  const normalized: Array<{ url: string; videoId: string; title: string; channelName: string | null }> = [];
  for (const value of items) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return json({ error: "각 item은 객체여야 합니다." }, { status: 400 });
    }
    const item = value as CanaryItem;
    const rawUrl = requiredBoundedString(item.url, 4_000);
    const title = requiredBoundedString(item.title, 300);
    const channelName = optionalBoundedString(item.channelName, 180);
    if (!rawUrl || !title || channelName === undefined) {
      return json({ error: "URL·제목·채널명 길이 또는 형식을 확인해 주세요." }, { status: 400 });
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return json({ error: "올바른 YouTube URL이 아닙니다." }, { status: 400 });
    }
    const url = parsedUrl.protocol === "https:" ? normalizeYouTubeUrl(rawUrl) : null;
    if (!url) return json({ error: "HTTPS YouTube 영상 URL만 사용할 수 있습니다." }, { status: 400 });
    const videoId = new URL(url).searchParams.get("v");
    if (!videoId) return json({ error: "YouTube video ID를 확인하지 못했습니다." }, { status: 400 });
    normalized.push({ url, videoId, title, channelName });
  }

  const videoIds = normalized.map((item) => item.videoId);
  if (new Set(videoIds).size !== videoIds.length) {
    return json({ error: "같은 YouTube 영상이 목록에 중복되어 있습니다." }, { status: 400 });
  }
  const normalizedUrls = normalized.map((item) => item.url);
  const runId = createHash("sha256").update(JSON.stringify(normalizedUrls), "utf8").digest("hex");

  const supabase = getServerSupabaseClient();
  if (!supabase) return json({ error: "지식 대기열 서버 설정이 준비되지 않았습니다." }, { status: 503 });
  const rateLimit = takeToken(`knowledge-canary-capture:${user.id}`, 2, 60_000);
  if (!rateLimit.ok) {
    return json(
      { error: "카나리 캡처 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }

  const results = [];
  for (const item of normalized) {
    const result = await enqueueKnowledgeCanaryCapture(supabase, {
      userId: user.id,
      runId,
      sourceUrl: item.url,
      title: item.title,
      channelName: item.channelName,
    });
    if (!result.ok && result.logMessage) {
      console.error(`[POST /api/knowledge/canary-capture ${result.code}]`, result.logMessage);
    }
    results.push(result.ok
      ? {
          videoId: item.videoId,
          job: result.job,
          created: result.created,
          cleanEligible: result.created,
        }
      : {
          videoId: item.videoId,
          code: result.code,
          error: CANARY_ERROR_MESSAGES[result.code],
          job: result.job,
          created: result.created ?? false,
          cleanEligible: false,
        });
  }

  const hasFailure = results.some((result) => "error" in result);
  const created = results.filter((result) => result.created).length;
  return json(
    { runId, requested: normalized.length, created, results },
    { status: hasFailure ? 207 : created > 0 ? 201 : 200 },
  );
}
