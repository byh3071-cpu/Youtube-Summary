import { cookies } from "next/headers";
import {
  getCurrentUserFromCookies,
  createServerSupabaseFromCookies,
} from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient, getMutationTable } from "@/lib/supabase-server";
import type { Database } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type BookmarkRow = {
  id: string;
  video_id: string;
  video_title: string;
  highlight: string;
  created_at: string;
};

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return Response.json([]);
  }
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) {
    return Response.json([]);
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");

  if (teamId) {
    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("team_id", teamId)
      .eq("user_id", user.id)
      .single();
    if (!member) {
      return Response.json({ error: "팀 접근 권한이 없습니다." }, { status: 403 });
    }
    // 팀 북마크는 RLS(user_id=auth.uid()) 때문에 anon으로는 본인 것만 보임 → service role로 전체 팀 북마크 조회
    const serverSupabase = getServerSupabaseClient();
    if (!serverSupabase) {
      return Response.json([]);
    }
    const { data, error } = await serverSupabase
      .from("bookmarks")
      .select("id, video_id, video_title, highlight, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[GET /api/bookmarks team]", error.message);
      return Response.json([]);
    }
    return Response.json((data ?? []) as BookmarkRow[]);
  }

  const { data, error } = await supabase
    .from("bookmarks")
    .select("id, video_id, video_title, highlight, created_at")
    .eq("user_id", user.id)
    .is("team_id", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[GET /api/bookmarks]", error.message);
    return Response.json([]);
  }
  return Response.json((data ?? []) as BookmarkRow[]);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) {
    return Response.json({ error: "서버 설정 오류" }, { status: 500 });
  }
  let body: { video_id?: string; video_title?: string; highlight?: string; team_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { video_id, video_title, highlight, team_id: bodyTeamId } = body;
  if (!video_id || !video_title) {
    return Response.json({ error: "video_id and video_title required" }, { status: 400 });
  }

  let teamId: string | null = null;
  if (bodyTeamId && typeof bodyTeamId === "string") {
    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("team_id", bodyTeamId)
      .eq("user_id", user.id)
      .single();
    if (!member) {
      return Response.json({ error: "팀 접근 권한이 없습니다." }, { status: 403 });
    }
    teamId = bodyTeamId;
  }

  const row: Database["public"]["Tables"]["bookmarks"]["Insert"] = {
    user_id: user.id,
    team_id: teamId ?? undefined,
    video_id,
    video_title,
    highlight: highlight ?? video_title,
  };
  const mutTable = getMutationTable("bookmarks");
  if (!mutTable) return Response.json({ error: "서버 설정 오류" }, { status: 500 });
  const { data, error } = await mutTable.insert(row).select("id").single();
  if (error) {
    if (error.code === "23505") {
      const q = supabase.from("bookmarks").select("id").eq("user_id", user.id).eq("video_id", video_id);
      const withTeam = teamId ? q.eq("team_id", teamId) : q.is("team_id", null);
      const { data: existing } = await withTeam.maybeSingle();
      return Response.json({ id: (existing as { id: string } | null)?.id ?? null });
    }
    console.error("[POST /api/bookmarks]", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ id: (data as { id: string })?.id });
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) {
    return Response.json({ error: "서버 설정 오류" }, { status: 500 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) {
    console.error("[DELETE /api/bookmarks]", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
