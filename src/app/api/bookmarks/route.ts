import { cookies } from "next/headers";
import {
  getCurrentUserFromCookies,
  createServerSupabaseFromCookies,
} from "@/lib/supabase-server-cookies";
import type { Database } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return Response.json([]);
  }
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) {
    return Response.json([]);
  }
  const { data, error } = await supabase
    .from("bookmarks")
    .select("id, video_id, video_title, highlight, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[GET /api/bookmarks]", error.message);
    return Response.json([]);
  }
  const rows = (data ?? []) as {
    id: string;
    video_id: string;
    video_title: string;
    highlight: string;
    created_at: string;
  }[];
  return Response.json(rows);
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
  let body: { video_id?: string; video_title?: string; highlight?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { video_id, video_title, highlight } = body;
  if (!video_id || !video_title) {
    return Response.json({ error: "video_id and video_title required" }, { status: 400 });
  }
  const row: Database["public"]["Tables"]["bookmarks"]["Insert"] = {
    user_id: user.id,
    video_id,
    video_title,
    highlight: highlight ?? video_title,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 제네릭 추론
  const { data, error } = await supabase.from("bookmarks").insert(row as any).select("id").single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("video_id", video_id)
        .maybeSingle();
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
