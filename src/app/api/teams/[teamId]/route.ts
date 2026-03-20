import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient, getMutationTable } from "@/lib/supabase-server";
import { canManageTeam } from "@/types/teams";

export async function PATCH(
  req: NextRequest,
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
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  const role = (member as { role?: string } | null)?.role;
  if (!role || !canManageTeam(role)) {
    return NextResponse.json({ error: "팀 설정 권한이 없습니다." }, { status: 403 });
  }

  let body: { name?: string; goal_text?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const updates: { name?: string; goal_text?: string | null } = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (trimmed) updates.name = trimmed;
  }
  if (typeof body.goal_text === "string" || body.goal_text === null) {
    updates.goal_text = body.goal_text === "" ? null : body.goal_text;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "변경할 필드가 없습니다." }, { status: 400 });
  }

  const teamsMut = getMutationTable("teams");
  if (!teamsMut) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }
  const { data: team, error } = await teamsMut
    .update(updates)
    .eq("id", teamId)
    .select("id, name, plan, goal_text, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "팀 수정 실패" }, { status: 500 });
  }
  return NextResponse.json({ team });
}
