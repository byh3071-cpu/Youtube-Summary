import { cookies } from "next/headers";
import {
  getCurrentUserFromCookies,
} from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient, type Database } from "@/lib/supabase-server";
import {
  parseKnowledgeStatusVideoIds,
  isKnowledgeJobsUnavailableError,
  type KnowledgeJobSummary,
} from "@/lib/knowledge-capture";

export const dynamic = "force-dynamic";

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

/** 현재 로그인 사용자의 YouTube 지식 작업 상태를 한 번에 최대 50개 조회한다. */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return Response.json({ error: "로그인해야 지식 처리 상태를 볼 수 있어요." }, { status: 401 });
  }

  const videoIds = parseKnowledgeStatusVideoIds(new URL(request.url).searchParams.get("videoIds"));
  if (!videoIds) {
    return Response.json(
      { error: "videoIds는 유효한 YouTube video ID를 최대 50개까지 받을 수 있어요." },
      { status: 400 },
    );
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return Response.json(
      { error: "지식 대기열 서버 설정이 아직 준비되지 않았습니다." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("knowledge_jobs")
    .select("id, video_id, status, capture_ready, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("source_type", "youtube")
    .in("video_id", videoIds);

  if (error) {
    if (isKnowledgeJobsUnavailableError(error)) {
      return Response.json(
        { error: "지식 대기열 DB가 아직 보이지 않습니다. 운영자에게 012 적용 또는 schema cache 확인을 요청하세요." },
        { status: 503 },
      );
    }
    console.error("[GET /api/knowledge/status]", error.message);
    return Response.json({ error: "지식 처리 상태를 불러오지 못했습니다." }, { status: 500 });
  }

  return Response.json(
    { jobs: (data ?? []).map(serializeJob) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
