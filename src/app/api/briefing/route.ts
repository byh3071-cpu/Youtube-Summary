import { NextRequest, NextResponse } from "next/server";
import { rankFeedByGoalsAction } from "@/app/actions/summarize";

const DEFAULT_GOALS =
  "나는 3개월 안에 1인 SaaS를 런칭하고 싶다. 프론트엔드는 할 줄 알고, 마케팅/세일즈와 AI 활용 전략이 약하다. 최신 AI·SaaS·마케팅 인사이트 위주로 오늘의 우선순위를 정리해 줘.";

function isAuthorized(req: NextRequest): boolean {
  // 개발 환경에서는 항상 허용
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const secret = process.env.BRIEFING_CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("x-cron-secret");
  return !!header && header === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const goals = searchParams.get("goals") || DEFAULT_GOALS;

  const result = await rankFeedByGoalsAction(goals, 24);

  return NextResponse.json(result);
}

