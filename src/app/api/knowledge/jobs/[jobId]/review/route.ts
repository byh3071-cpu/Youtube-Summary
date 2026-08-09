import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { isKnowledgeJobsUnavailableError, parseKnowledgeReviewDetail } from "@/lib/knowledge-capture";

export const dynamic = "force-dynamic";

const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  if (!JOB_ID_PATTERN.test(jobId)) {
    return Response.json({ error: "검토 항목 ID가 올바르지 않아요." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return Response.json({ error: "로그인해야 검토 내용을 볼 수 있어요." }, { status: 401 });

  const supabase = getServerSupabaseClient();
  if (!supabase) return Response.json({ error: "지식 검토 서버 설정이 아직 준비되지 않았어요." }, { status: 503 });

  const { data, error } = await supabase.from("knowledge_jobs")
    .select("id, user_id, status, result, quality_score, quality_report")
    .eq("user_id", user.id)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    if (isKnowledgeJobsUnavailableError(error)) {
      return Response.json({ error: "지식 대기열 DB가 아직 준비되지 않았어요." }, { status: 503 });
    }
    console.error("[GET /api/knowledge/jobs/:jobId/review]", error.message);
    return Response.json({ error: "검토 내용을 불러오지 못했어요." }, { status: 500 });
  }
  if (!data) return Response.json({ error: "검토 항목을 찾지 못했어요." }, { status: 404 });

  const review = parseKnowledgeReviewDetail({
    status: data.status,
    result: data.result,
    qualityScore: data.quality_score,
    qualityReport: data.quality_report,
  });
  if (!review) {
    return Response.json({ error: "아직 검토할 수 있는 상태가 아니에요." }, { status: 409 });
  }

  return Response.json(
    { review },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
