"use server";

import { getSupabaseForSummaries } from "@/lib/supabase-server";
import type { RadioQueueItem } from "@/contexts/RadioQueueContext";

// 라디오 큐를 Supabase playlists 테이블에 저장
export async function savePlaylistAction(
  items: RadioQueueItem[],
  title?: string,
) {
  const supabase = getSupabaseForSummaries();
  if (!supabase) {
    return { error: "Supabase 설정(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)이 필요합니다." };
  }

  if (!items.length) {
    return { error: "저장할 항목이 없습니다." };
  }

  const { data, error } = await supabase
    .from("playlists")
    .insert({
      title: title ?? null,
      items, // [{ videoId, title, summary? }, ...] 그대로 jsonb로 저장
    } as any)
    .select("id")
    .single();

  if (error || !data) {
    console.error("savePlaylistAction error:", error);
    return { error: "플레이리스트 저장에 실패했습니다." };
  }

  return { id: (data as any).id as string };
}