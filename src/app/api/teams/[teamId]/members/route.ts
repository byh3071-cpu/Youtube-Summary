import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient, getMutationTable } from "@/lib/supabase-server";

/* ------------------------------------------------------------------ */
/*  GET  /api/teams/[teamId]/members — 팀 멤버 목록                    */
/* ------------------------------------------------------------------ */
export async function GET(
  _req: NextRequest,
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

  // 요청자가 팀 멤버인지 확인
  const { data: self } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  if (!self) {
    return NextResponse.json({ error: "팀 멤버가 아닙니다." }, { status: 403 });
  }

  // 팀 멤버 목록 조회
  const { data: members, error } = await supabase
    .from("team_members")
    .select("id, user_id, role, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "멤버 목록 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ members: members ?? [] });
}

/* ------------------------------------------------------------------ */
/*  DELETE  /api/teams/[teamId]/members — 멤버 제거                    */
/* ------------------------------------------------------------------ */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { memberId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const memberId = body.memberId;
  if (!memberId) {
    return NextResponse.json({ error: "memberId가 필요합니다." }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  // 요청자 권한 확인 (owner 또는 admin만 가능)
  const { data: self } = await supabase
    .from("team_members")
    .select("id, role")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  const selfRole = (self as { id?: string; role?: string } | null)?.role;
  if (!selfRole || (selfRole !== "owner" && selfRole !== "admin")) {
    return NextResponse.json({ error: "멤버 제거 권한이 없습니다." }, { status: 403 });
  }

  // 대상 멤버 조회
  const { data: targetData } = await supabase
    .from("team_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("team_id", teamId)
    .single();

  const target = targetData as { id: string; user_id: string; role: string } | null;
  if (!target) {
    return NextResponse.json({ error: "멤버를 찾을 수 없습니다." }, { status: 404 });
  }

  // 자신이 유일한 owner인 경우 자기 자신 제거 방지
  if (target.user_id === user.id && target.role === "owner") {
    const { count } = await supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("role", "owner");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "유일한 소유자는 팀을 떠날 수 없습니다." },
        { status: 400 },
      );
    }
  }

  const membersMut = getMutationTable("team_members");
  if (!membersMut) return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  const { error } = await membersMut
    .delete()
    .eq("id", memberId)
    .eq("team_id", teamId);

  if (error) {
    return NextResponse.json({ error: "멤버 제거 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/* ------------------------------------------------------------------ */
/*  PATCH  /api/teams/[teamId]/members — 멤버 역할 변경                */
/* ------------------------------------------------------------------ */
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

  let body: { memberId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const { memberId, role } = body;
  if (!memberId || !role) {
    return NextResponse.json({ error: "memberId와 role이 필요합니다." }, { status: 400 });
  }

  const validRoles = ["owner", "admin", "member"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "유효하지 않은 역할입니다." }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  // 요청자가 owner인지 확인
  const { data: self } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  const selfRole = (self as { role?: string } | null)?.role;
  if (selfRole !== "owner") {
    return NextResponse.json({ error: "역할 변경은 소유자만 가능합니다." }, { status: 403 });
  }

  // 대상 멤버가 같은 팀에 속하는지 확인
  const { data: target } = await supabase
    .from("team_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("team_id", teamId)
    .single();

  if (!target) {
    return NextResponse.json({ error: "멤버를 찾을 수 없습니다." }, { status: 404 });
  }

  const membersMut = getMutationTable("team_members");
  if (!membersMut) return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  const { error } = await membersMut
    .update({ role })
    .eq("id", memberId)
    .eq("team_id", teamId);

  if (error) {
    return NextResponse.json({ error: "역할 변경 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
