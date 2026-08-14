import { cookies } from "next/headers";
import {
  createServerSupabaseFromCookies,
  getCurrentUserFromCookies,
} from "@/lib/supabase-server-cookies";
import { buildKnowledgeCaptureMetadata } from "@/lib/knowledge-capture";
import {
  enqueueAndEnrichKnowledgeCapture,
  type KnowledgeCaptureFailureCode,
} from "@/lib/knowledge-capture-server";
import { takeToken } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type CaptureBody = {
  url?: unknown;
  title?: unknown;
  channelName?: unknown;
  via?: unknown;
};

function asShortText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function captureVia(value: unknown): "focus-feed" | "share" | "bookmarklet" {
  return value === "share" || value === "bookmarklet" ? value : "focus-feed";
}

const CAPTURE_ERROR_MESSAGES: Record<KnowledgeCaptureFailureCode, string> = {
  NORMALIZATION_FAILED: "지식 대기열 접수에 실패했습니다.",
  QUEUE_UNAVAILABLE: "지식 대기열을 일시적으로 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  QUEUE_LIMIT: "지식 대기열 한도에 도달했습니다. 처리 중 작업을 마치거나 내일 다시 시도해 주세요.",
  ENQUEUE_FAILED: "지식 대기열 접수에 실패했습니다.",
  EMPTY_RESPONSE: "지식 대기열 응답을 확인하지 못했습니다.",
  ENRICH_METADATA_FAILED: "접수된 작업의 처리 준비 정보를 만들지 못했습니다.",
  ENRICH_UNAVAILABLE: "영상은 접수됐지만 처리 준비를 마치지 못했습니다. 잠시 후 같은 영상을 다시 눌러 주세요.",
  ENRICH_FAILED: "영상은 접수됐지만 처리 준비를 마치지 못했습니다. 잠시 후 같은 영상을 다시 눌러 주세요.",
  ENRICH_EMPTY: "접수된 작업의 처리 준비 상태를 확인하지 못했습니다. 상태를 새로고침한 뒤 다시 시도해 주세요.",
};

/**
 * POST만 상태를 만든다. GET 공유 링크는 /capture 확인 화면에서 멈춘다.
 * 이 분리는 iPhone 단축어·브라우저 북마클릿에서의 실수 접수를 막는다.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return Response.json({ error: "로그인 후 지식 대기열에 담을 수 있어요." }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return Response.json({ error: "올바른 JSON 요청이 아닙니다." }, { status: 400 });
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return Response.json({ error: "JSON 객체 요청이 필요합니다." }, { status: 400 });
  }
  const body = parsedBody as CaptureBody;

  const rawUrl = asShortText(body.url, 4_000);
  if (!rawUrl) {
    return Response.json({ error: "YouTube 영상 URL이 필요합니다." }, { status: 400 });
  }

  const requested = buildKnowledgeCaptureMetadata({
    sourceUrl: rawUrl,
    title: asShortText(body.title, 300),
    channelName: asShortText(body.channelName, 180),
  });
  if (!requested) {
    return Response.json({ error: "지원하는 YouTube 영상 URL만 담을 수 있어요." }, { status: 400 });
  }

  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) {
    return Response.json(
      { error: "지식 대기열 서버 설정이 아직 준비되지 않았습니다." },
      { status: 503 },
    );
  }

  const rateLimit = takeToken(`knowledge-capture:${user.id}`, 10, 60_000);
  if (!rateLimit.ok) {
    return Response.json(
      { error: "지식 대기열 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }

  const result = await enqueueAndEnrichKnowledgeCapture(supabase, {
    sourceUrl: requested.sourceUrl,
    title: requested.title,
    channelName: requested.channelName,
    metadata: {
      capture_version: 1,
      received_via: captureVia(body.via),
      description_guide: "filtered",
    },
  });

  if (!result.ok) {
    if (result.logMessage) {
      const logLabel = result.code === "QUEUE_UNAVAILABLE"
        ? "[POST /api/knowledge/capture unavailable]"
        : result.code === "ENRICH_UNAVAILABLE" || result.code === "ENRICH_FAILED"
          ? "[POST /api/knowledge/capture enrich]"
          : "[POST /api/knowledge/capture]";
      console.error(logLabel, result.logMessage);
    }
    return Response.json(
      {
        error: CAPTURE_ERROR_MESSAGES[result.code],
        ...(result.job ? { job: result.job } : {}),
        ...(result.created !== undefined ? { created: result.created } : {}),
      },
      {
        status: result.status,
        headers: result.retryAfter ? { "Retry-After": result.retryAfter } : undefined,
      },
    );
  }

  return Response.json(
    { job: result.job, created: result.created },
    { status: result.created ? 201 : 200 },
  );
}
