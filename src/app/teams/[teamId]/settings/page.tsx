import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import type { TeamRow, TeamMemberRow } from "@/types/teams";
import { canManageTeam } from "@/types/teams";
import TeamSettingsClient from "./TeamSettingsClient";

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-(--notion-fg)/70">로그인이 필요합니다.</p>
        <Link href={`/login?next=/teams/${teamId}/settings`} className="mt-4 inline-block text-sm underline">
          로그인
        </Link>
      </main>
    );
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-(--notion-fg)/70">서버 설정 오류</p>
      </main>
    );
  }

  const { data: memberData } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  const member = memberData as TeamMemberRow | null;
  if (!member) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-(--notion-fg)/70">팀 접근 권한이 없습니다.</p>
        <Link href="/teams" className="mt-4 inline-block text-sm underline">팀 목록</Link>
      </main>
    );
  }

  const { data: teamData } = await supabase
    .from("teams")
    .select("id, name, plan, goal_text, created_at")
    .eq("id", teamId)
    .single();

  const team = teamData as TeamRow | null;
  if (!team) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-(--notion-fg)/70">팀을 찾을 수 없습니다.</p>
        <Link href="/teams" className="mt-4 inline-block text-sm underline">팀 목록</Link>
      </main>
    );
  }

  const canManage = canManageTeam(member.role);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/teams" className="mb-6 inline-block text-sm font-medium text-(--notion-fg)/80 hover:text-(--notion-fg)">
        ← 팀 목록
      </Link>
      <h1 className="mb-6 text-2xl font-bold">{team.name} 설정</h1>
      <TeamSettingsClient
        teamId={teamId}
        initialName={team.name}
        initialGoalText={team.goal_text ?? ""}
        canManage={canManage}
      />
    </main>
  );
}
