import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import type { TeamRow, TeamMemberSummary, TeamWithRole } from "@/types/teams";
import TeamsClient from "./TeamsClient";

export default async function TeamsPage() {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-(--notion-fg)/70">로그인이 필요합니다.</p>
        <Link href="/login?next=/teams" className="mt-4 inline-block text-sm font-medium text-(--notion-fg) underline">
          로그인
        </Link>
      </main>
    );
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-(--notion-fg)/70">서버 설정 오류입니다.</p>
      </main>
    );
  }

  const { data: membersData } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", user.id);

  const members = (membersData ?? []) as TeamMemberSummary[];
  const teamIds = members.map((m) => m.team_id);
  const { data: teamsData } = teamIds.length
    ? await supabase.from("teams").select("id, name, plan, goal_text, created_at").in("id", teamIds)
    : { data: [] as TeamRow[] };
  const teams = (teamsData ?? []) as TeamRow[];

  const withRole: TeamWithRole[] = teams.map((t) => {
    const m = members.find((x) => x.team_id === t.id);
    return { ...t, role: m?.role ?? "member" };
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="mb-6 inline-block text-sm font-medium text-(--notion-fg)/80 hover:text-(--notion-fg)">
        ← 피드로
      </Link>
      <h1 className="mb-6 text-2xl font-bold">내 팀</h1>
      <TeamsClient teams={withRole} />
    </main>
  );
}
