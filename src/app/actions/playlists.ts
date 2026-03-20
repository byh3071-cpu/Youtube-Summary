"use server";

import { getTypedTable, getMutationTable, type Database } from "@/lib/supabase-server";
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

  const mutTable = getMutationTable("playlists");
  if (!mutTable) return { error: "Supabase 설정 오류" };
  const { data, error } = await mutTable.insert(row).select("id").single();

  if (error || !data) {
    console.error("savePlaylistAction error:", error);
    return { error: "플레이리스트 저장에 실패했습니다." };
  }

  return { id: (data as { id: string }).id };
}

// 플레이리스트 이름 변경
export async function renamePlaylistAction(playlistId: string, newTitle: string) {
  const table = getTypedTable("playlists");
  if (!table) {
    return { error: "Supabase 설정(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)이 필요합니다." };
  }

  if (!playlistId || !newTitle.trim()) {
    return { error: "플레이리스트 ID와 새 제목이 필요합니다." };
  }

  const mutTable = getMutationTable("playlists");
  if (!mutTable) return { error: "Supabase 설정 오류" };
  const { error } = await mutTable
    .update({ title: newTitle.trim() })
    .eq("id", playlistId);

  if (error) {
    console.error("renamePlaylistAction error:", error);
    return { error: "플레이리스트 이름 변경에 실패했습니다." };
  }

  return { ok: true };
}

// 플레이리스트 삭제
export async function deletePlaylistAction(playlistId: string) {
  const table = getTypedTable("playlists");
  if (!table) {
    return { error: "Supabase 설정(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)이 필요합니다." };
  }

  if (!playlistId) {
    return { error: "플레이리스트 ID가 필요합니다." };
  }

  const mutTable = getMutationTable("playlists");
  if (!mutTable) return { error: "Supabase 설정 오류" };
  const { error } = await mutTable
    .delete()
    .eq("id", playlistId);

  if (error) {
    console.error("deletePlaylistAction error:", error);
    return { error: "플레이리스트 삭제에 실패했습니다." };
  }

  return { ok: true };
}