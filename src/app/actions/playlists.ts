"use server";

import { getTypedTable, type Database } from "@/lib/supabase-server";
import type { RadioQueueItem } from "@/contexts/RadioQueueContext";

// 라디오 큐를 Supabase playlists 테이블에 저장. userId가 있으면 해당 사용자 소유로 저장.
export async function savePlaylistAction(
  items: RadioQueueItem[],
  title?: string,
  userId?: string | null,
) {
  const table = getTypedTable("playlists");
  if (!table) {
    return { error: "Supabase 설정(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)이 필요합니다." };
  }

  if (!items.length) {
    return { error: "저장할 항목이 없습니다." };
  }

  const row: Database["public"]["Tables"]["playlists"]["Insert"] = {
    user_id: userId ?? null,
    title: title ?? null,
    items: items as unknown as Database["public"]["Tables"]["playlists"]["Row"]["items"],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (table as any).insert(row).select("id").single();

  if (error || !data) {
    console.error("savePlaylistAction error:", error);
    return { error: "플레이리스트 저장에 실패했습니다." };
  }

  return { id: (data as { id: string }).id };
}