import Link from "next/link";
import { cookies } from "next/headers";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import type { RadioQueueItem } from "@/contexts/RadioQueueContext";
import PlaylistsClient from "./PlaylistsClient";
import FloatingRadioPlayer from "@/components/player/FloatingRadioPlayer";

export default async function MyPlaylistsPage() {
  const supabase = getServerSupabaseClient();
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);

  if (!supabase) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1 text-xs font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
        >
          <span>← 피드로 돌아가기</span>
        </Link>
        <h1 className="mb-4 text-2xl font-bold text-(--notion-fg)">내 플레이리스트</h1>
        <p className="text-sm text-(--notion-fg)/65">
          Supabase 연결이 설정되지 않았습니다. .env.local에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정해 주세요.
        </p>
      </main>
    );
  }

  let query = supabase
    .from("playlists")
    .select("id, title, items, created_at")
    .order("created_at", { ascending: false });
  if (user) {
    query = query.eq("user_id", user.id);
  } else {
    query = query.is("user_id", null);
  }
  const { data, error } = (await query) as {
    data: { id: string; title: string | null; items: unknown; created_at: string }[] | null;
    error: unknown;
  };

  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1 text-xs font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
        >
          <span>← 피드로 돌아가기</span>
        </Link>
        <h1 className="mb-4 text-2xl font-bold text-(--notion-fg)">내 플레이리스트</h1>
        <p className="text-sm text-(--notion-fg)/65">플레이리스트를 불러오는 중 오류가 발생했습니다.</p>
      </main>
    );
  }

  const playlists = data.map((row) => ({
    id: row.id,
    title: row.title,
    items: (row.items as RadioQueueItem[]) ?? [],
    created_at: row.created_at,
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1 text-xs font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
      >
        <span>← 피드로 돌아가기</span>
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-(--notion-fg)">내 플레이리스트</h1>
      <p className="mb-6 text-sm text-(--notion-fg)/65">
        재생 대기열에서 저장한 여러 영상을 한 세트로 묶어 둔 목록입니다. 집중해서 듣고 싶은 테마나 연달아 듣고 싶은 강의 묶음을 만들어 두세요.
      </p>
      <PlaylistsClient playlists={playlists} />
      <div className="fixed inset-x-0 bottom-0 z-40">
        <FloatingRadioPlayer />
      </div>
    </main>
  );
}
