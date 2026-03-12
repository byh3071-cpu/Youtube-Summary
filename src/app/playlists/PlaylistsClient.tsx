"use client";

import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import type { RadioQueueItem } from "@/contexts/RadioQueueContext";
import { ListMusic } from "lucide-react";

interface PlaylistsClientProps {
  playlists: {
    id: string;
    title: string | null;
    items: RadioQueueItem[];
    created_at: string;
  }[];
}

export default function PlaylistsClient({ playlists }: PlaylistsClientProps) {
  const radio = useRadioQueueOptional();

  if (!radio) {
    return <p className="text-sm text-(--notion-fg)/70">라디오 플레이어가 초기화되는 중입니다.</p>;
  }

  const handleLoad = (pl: { id: string; title: string | null; items: RadioQueueItem[] }) => {
    if (!pl.items || pl.items.length === 0) return;
    radio.replaceQueue(pl.items);
  };

  if (playlists.length === 0) {
    return (
      <p className="text-sm text-(--notion-fg)/65">
        아직 저장된 플레이리스트가 없습니다. 라디오 플레이어의 재생 대기열 서랍에서 현재 큐를 플레이리스트로 저장해 보세요.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {playlists.map((pl) => (
        <li
          key={pl.id}
          className="flex items-center justify-between rounded-xl border border-(--notion-border) bg-(--notion-bg) px-4 py-3"
        >
          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-2">
              <ListMusic size={15} className="text-(--notion-fg)/60" />
              <p className="truncate text-sm font-semibold text-(--notion-fg)">
                {pl.title || "제목 없는 플레이리스트"}
              </p>
            </div>
            <p className="text-[11px] text-(--notion-fg)/60">
              {pl.items.length}개 영상 · {new Date(pl.created_at).toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-(--notion-fg)/55">
              집중해서 듣고 싶은 주제나 강의를 한 번에 재생할 수 있는 목록입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleLoad(pl)}
            className="ml-3 rounded-full bg-(--notion-fg) px-3 py-1 text-[11px] font-semibold text-(--notion-bg) hover:bg-(--notion-fg)/90"
          >
            이 플레이리스트로 듣기
          </button>
        </li>
      ))}
    </ul>
  );
}
