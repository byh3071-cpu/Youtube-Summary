import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient, getMutationTable } from "@/lib/supabase-server";

type LockoutCheck = { ok: true } | { ok: false; status: number; error: string };

/**
 * owner 멤버 제거 시 팀이 소유자 없이 락아웃되는 것을 막는다.
 * - admin은 다른 owner를 제거할 수 없다(owner만 owner를 건드릴 수 있음).
 * - 마지막 owner는 제거할 수 없다(자기 자신이든 타인이든).
 * 대상이 owner가 아니면 통과.
 */
export function checkOwnerLockoutOnRemove(
  selfRole: string,
  targetRole: string,
  ownerCount: number,
): LockoutCheck {
  if (targetRole !== "owner") return { ok: true };
  if (selfRole !== "owner") {
    return { ok: false, status: 403, error: "소유자는 다른 소유자만 제거할 수 있습니다." };
  }
  if (ownerCount <= 1) {
    return { ok: false, status: 400, error: "유일한 소유자는 제거할 수 없습니다." };
  }
  return { ok: true };
}

/**
 * owner를 다른 역할로 강등할 때 마지막 owner가 강등돼 팀이 락아웃되는 것을 막는다.
 * owner→owner(무변경)나 owner가 2명 이상이면 통과.
 */
export function checkOwnerLockoutOnRoleChange(
  targetRole: string,
  newRole: string,
  ownerCount: number,
): LockoutCheck {
  if (targetRole === "owner" && newRole !== "owner" && ownerCount <= 1) {
    return { ok: false, status: 400, error: "마지막 소유자의 역할은 변경할 수 없습니다." };
  }
  return { ok: true };
}

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

  // 대상이 owner이면 소유자 락아웃 방지:
  // admin은 owner를 제거할 수 없고, 마지막 owner는 자기든 타인이든 제거 불가
  if (target.role === "owner") {
    const { count } = await supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("role", "owner");

    const check = checkOwnerLockoutOnRemove(selfRole, target.role, count ?? 0);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status });
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
  const { data: targetData } = await supabase
    .from("team_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("team_id", teamId)
    .single();

  const target = targetData as { id: string; role: string } | null;
  if (!target) {
    return NextResponse.json({ error: "멤버를 찾을 수 없습니다." }, { status: 404 });
  }

  // owner를 다른 역할로 강등하는 경우 마지막 owner 보호 (팀 락아웃 방지)
  if (target.role === "owner" && role !== "owner") {
    const { count } = await supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("role", "owner");

    const check = checkOwnerLockoutOnRoleChange(target.role, role, count ?? 0);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }
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
