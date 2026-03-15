import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import type { TeamRow, TeamMemberSummary, TeamWithRole } from "@/types/teams";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  const { data: membersData, error: membersError } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", user.id);

  const members = (membersData ?? []) as TeamMemberSummary[];
  if (membersError || !members.length) {
    return NextResponse.json({ teams: [] });
  }

  const teamIds = members.map((m) => m.team_id);
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, plan, goal_text, created_at")
    .in("id", teamIds);

  if (teamsError) {
    return NextResponse.json({ error: "팀 목록 조회 실패" }, { status: 500 });
  }

  const teamsList = (teams ?? []) as TeamRow[];
  const withRole: TeamWithRole[] = teamsList.map((t) => {
    const m = members.find((x) => x.team_id === t.id);
    return { ...t, role: m?.role ?? "member" };
  });

  return NextResponse.json({ teams: withRole });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "팀 이름을 입력하세요." }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  const { data: teamData, error: teamError } = await (supabase as any)
    .from("teams")
    .insert({ name, plan: "free" })
    .select("id, name, plan, created_at")
    .single();

  const team = teamData as (Pick<TeamRow, "id" | "name" | "plan" | "created_at">) | null;
  if (teamError || !team) {
    const message = teamError?.message ?? "팀 생성 실패";
    console.error("[POST /api/teams] teams insert:", message);
    return NextResponse.json({ error: `팀 생성 실패: ${message}` }, { status: 500 });
  }

  const { error: memberError } = await (supabase as any).from("team_members").insert({
    team_id: team.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    await (supabase as any).from("teams").delete().eq("id", team.id);
    const message = memberError.message ?? "멤버 추가 실패";
    console.error("[POST /api/teams] team_members insert:", message);
    return NextResponse.json({ error: `팀 생성 실패: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ team: { ...team, role: "owner" } });
}
