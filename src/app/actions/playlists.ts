"use server";

import { getSupabaseForSummaries, type Database } from "@/lib/supabase-server";
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

  const row: Database["public"]["Tables"]["playlists"]["Insert"] = {
    title: title ?? null,
    items: items as unknown as Database["public"]["Tables"]["playlists"]["Row"]["items"],
  };
  // Supabase 클라이언트 제네릭이 테이블별로 추론되지 않아 단언 사용 (빌드 호환)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase table insert 타입 추론 한계
  const { data, error } = await (supabase.from("playlists") as any).insert(row).select("id").single();

  if (error || !data) {
    console.error("savePlaylistAction error:", error);
    return { error: "플레이리스트 저장에 실패했습니다." };
  }

  return { id: (data as { id: string }).id };
}