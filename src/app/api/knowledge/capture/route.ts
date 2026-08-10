import { cookies } from "next/headers";
import {
  createServerSupabaseFromCookies,
  getCurrentUserFromCookies,
} from "@/lib/supabase-server-cookies";
import type { Database } from "@/lib/supabase-server";
import {
  buildKnowledgeCaptureMetadata,
  isKnowledgeJobsUnavailableError,
  type KnowledgeJobSummary,
} from "@/lib/knowledge-capture";
import { getVideoSnippet } from "@/lib/youtube";
import { takeToken } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type CaptureBody = {
  url?: unknown;
  title?: unknown;
  channelName?: unknown;
  via?: unknown;
};

type JobSummaryRow = Pick<
  Database["public"]["Tables"]["knowledge_jobs"]["Row"],
  "id" | "video_id" | "status" | "capture_ready" | "created_at" | "updated_at"
>;

function serializeJob(row: JobSummaryRow): KnowledgeJobSummary {
  return {
    id: row.id,
    videoId: row.video_id,
    status: row.status,
    captureReady: row.capture_ready,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function asShortText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function captureVia(value: unknown): "focus-feed" | "share" | "bookmarklet" {
  return value === "share" || value === "bookmarklet" ? value : "focus-feed";
}

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

  const { data, error } = await supabase.rpc("enqueue_knowledge_job", {
    p_source_type: "youtube",
    p_source_key: requested.videoId,
    p_source_url: requested.sourceUrl,
    p_video_id: requested.videoId,
    p_title: requested.title,
    p_channel_name: requested.channelName,
    p_source_guide: requested.sourceGuide,
    p_metadata: {
      capture_version: 1,
      received_via: captureVia(body.via),
      description_guide: "filtered",
    },
  });

  if (error) {
    if (isKnowledgeJobsUnavailableError(error)) {
      console.error("[POST /api/knowledge/capture unavailable]", error.message);
      return Response.json(
        { error: "지식 대기열을 일시적으로 확인할 수 없습니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }
    if (error.code === "P0001" && error.message.includes("knowledge_queue_")) {
      return Response.json(
        { error: "지식 대기열 한도에 도달했습니다. 처리 중 작업을 마치거나 내일 다시 시도해 주세요." },
        { status: 429 },
      );
    }
    console.error("[POST /api/knowledge/capture]", error.message);
    return Response.json({ error: "지식 대기열 접수에 실패했습니다." }, { status: 500 });
  }

  const job = data?.[0];
  if (!job) {
    return Response.json({ error: "지식 대기열 응답을 확인하지 못했습니다." }, { status: 500 });
  }

  let responseJob: JobSummaryRow = job;
  if (!job.capture_ready) {
    // enqueue는 처리 예약만 만든다. 이 보강 RPC가 완료되기 전에는 worker가 claim할 수 없다.
    // 첫 요청이 중단돼도 같은 URL을 다시 누르면 미완료 예약만 이어서 준비한다.
    const snippet = await getVideoSnippet(requested.videoId);
    const enriched = buildKnowledgeCaptureMetadata({
      sourceUrl: requested.sourceUrl,
      title: snippet?.title ?? requested.title,
      channelName: snippet?.channelName ?? requested.channelName,
      description: snippet?.description,
    });
    if (!enriched) {
      return Response.json(
        { error: "접수된 작업의 처리 준비 정보를 만들지 못했습니다.", job: serializeJob(job), created: job.created },
        { status: 500 },
      );
    }

    const { data: enrichedRows, error: enrichError } = await supabase.rpc("enrich_knowledge_job", {
      p_job_id: job.id,
      p_title: enriched.title,
      p_channel_name: enriched.channelName,
      p_source_guide: enriched.sourceGuide,
    });
    if (enrichError) {
      console.error("[POST /api/knowledge/capture enrich]", enrichError.message);
      const unavailable = isKnowledgeJobsUnavailableError(enrichError);
      return Response.json(
        {
          error: "영상은 접수됐지만 처리 준비를 마치지 못했습니다. 잠시 후 같은 영상을 다시 눌러 주세요.",
          job: serializeJob(job),
          created: job.created,
        },
        {
          status: unavailable ? 503 : 500,
          headers: unavailable ? { "Retry-After": "5" } : undefined,
        },
      );
    }
    if (!enrichedRows?.[0]) {
      return Response.json(
        {
          error: "접수된 작업의 처리 준비 상태를 확인하지 못했습니다. 상태를 새로고침한 뒤 다시 시도해 주세요.",
          job: serializeJob(job),
          created: job.created,
        },
        { status: 409 },
      );
    }
    responseJob = enrichedRows[0];
  }
  return Response.json(
    { job: serializeJob(responseJob), created: job.created },
    { status: job.created ? 201 : 200 },
  );
}
