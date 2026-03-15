import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase-server";
import type { TeamInviteRow } from "@/types/teams";
import Link from "next/link";

export default async function TeamJoinPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = searchParams != null ? await searchParams : {};
  const token = typeof params.token === "string" ? params.token : undefined;
  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-(--notion-bg) px-4">
        <div className="text-center">
          <p className="text-(--notion-fg)/70">유효하지 않은 초대 링크입니다.</p>
          <Link href="/" className="mt-4 inline-block text-sm underline text-(--notion-fg)/60 hover:text-(--notion-fg)">
            홈으로
          </Link>
        </div>
      </main>
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/teams/join?token=${encodeURIComponent(token)}`);
  }

  const serverSupabase = await import("@/lib/supabase-server").then((m) => m.getServerSupabaseClient());
  if (!serverSupabase) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-(--notion-bg) px-4">
        <p className="text-(--notion-fg)/70">서버 설정 오류입니다.</p>
      </main>
    );
  }

  const { data: inviteData } = await serverSupabase
    .from("team_invites")
    .select("id, team_id, email, expires_at")
    .eq("token", token)
    .single();

  const invite = inviteData as (Pick<TeamInviteRow, "id" | "team_id" | "email" | "expires_at">) | null;
  if (!invite || new Date(invite.expires_at) < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-(--notion-bg) px-4">
        <div className="text-center">
          <p className="text-(--notion-fg)/70">만료되었거나 잘못된 초대 링크입니다.</p>
          <Link href="/" className="mt-4 inline-block text-sm underline text-(--notion-fg)/60">
            홈으로
          </Link>
        </div>
      </main>
    );
  }

  const { error: insertError } = await (serverSupabase as any).from("team_members").upsert(
    { team_id: invite.team_id, user_id: user.id, role: "member" },
    { onConflict: "team_id,user_id" },
  );

  if (!insertError) {
    await (serverSupabase as any).from("team_invites").delete().eq("id", invite.id);
  }

  redirect("/?team_joined=1");
}
