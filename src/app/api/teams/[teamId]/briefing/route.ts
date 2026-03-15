import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { rankFeedByGoalsAction } from "@/app/actions/summarize";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  const { data: member } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "팀 접근 권한이 없습니다." }, { status: 403 });
  }

  const { data: team } = await supabase.from("teams").select("goal_text").eq("id", teamId).single();
  const goalText = (team as { goal_text?: string | null } | null)?.goal_text?.trim();
  if (!goalText) {
    return NextResponse.json({ error: "팀 목표가 설정되지 않았습니다." }, { status: 400 });
  }

  const result = await rankFeedByGoalsAction(goalText, 10);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ranked: result.ranked });
}
