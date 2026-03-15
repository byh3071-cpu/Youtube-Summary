import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import type { TeamRow, TeamMemberRow } from "@/types/teams";
import TeamBookmarksClient from "./TeamBookmarksClient";

export default async function TeamBookmarksPage({
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
        <Link href={`/login?next=/teams/${teamId}/bookmarks`} className="mt-4 inline-block text-sm underline">
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
    .select("name")
    .eq("id", teamId)
    .single();

  const team = teamData as TeamRow | null;
  const teamName = team?.name ?? "팀";

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/teams" className="mb-6 inline-block text-sm font-medium text-(--notion-fg)/80 hover:text-(--notion-fg)">
        ← 팀 목록
      </Link>
      <h1 className="mb-2 text-2xl font-bold">{teamName} 북마크</h1>
      <p className="mb-6 text-sm text-(--notion-fg)/60">
        팀원과 공유하는 북마크입니다. 링크를 추가하면 팀원 모두가 볼 수 있어요.
      </p>
      <TeamBookmarksClient teamId={teamId} />
    </main>
  );
}
