"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { renamePlaylistAction, deletePlaylistAction } from "@/app/actions/playlists";

interface PlaylistItem {
  id: string;
  title: string | null;
  items: unknown;
}

interface PlaylistManagerProps {
  playlists: PlaylistItem[];
}

export function PlaylistManager({ playlists: initialPlaylists }: PlaylistManagerProps) {
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = (pl: PlaylistItem) => {
    setEditingId(pl.id);
    setEditValue(pl.title ?? "");
    setDeletingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditValue("");
  };

  const confirmRename = async () => {
    if (!editingId || busy) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }
    setBusy(true);
    const res = await renamePlaylistAction(editingId, trimmed);
    if (!("error" in res)) {
      setPlaylists((prev) =>
        prev.map((pl) => (pl.id === editingId ? { ...pl, title: trimmed } : pl)),
      );
    }
    setBusy(false);
    cancelRename();
  };

  const confirmDelete = async (id: string) => {
    if (busy) return;
    setBusy(true);
    const res = await deletePlaylistAction(id);
    if (!("error" in res)) {
      setPlaylists((prev) => prev.filter((pl) => pl.id !== id));
    }
    setBusy(false);
    setDeletingId(null);
  };

  if (!playlists.length) {
    return (
      <p className="py-8 text-center text-sm text-(--notion-fg)/50">
        저장된 플레이리스트가 없습니다.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-(--notion-border)">
      {playlists.map((pl) => {
        const isEditing = editingId === pl.id;
        const isDeleting = deletingId === pl.id;
        const itemCount = Array.isArray(pl.items) ? pl.items.length : 0;

        return (
          <li
            key={pl.id}
            className="group flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-(--notion-gray)/50"
          >
            {/* Title / inline edit */}
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void confirmRename();
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") cancelRename();
                    }}
                    disabled={busy}
                    className="w-full rounded border border-(--notion-border) bg-(--notion-bg) px-2 py-1 text-sm text-(--notion-fg) outline-none focus:border-(--focus-accent)"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="shrink-0 rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
                    aria-label="이름 변경 확인"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    disabled={busy}
                    className="shrink-0 rounded p-1 text-(--notion-fg)/50 hover:bg-(--notion-hover) disabled:opacity-50"
                    aria-label="취소"
                  >
                    <X size={14} />
                  </button>
                </form>
              ) : (
                <div>
                  <span className="block truncate text-sm font-medium text-(--notion-fg)">
                    {pl.title || "제목 없음"}
                  </span>
                  <span className="text-xs text-(--notion-fg)/45">
                    {itemCount}곡
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            {!isEditing && (
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {isDeleting ? (
                  <>
                    <span className="mr-1 text-xs text-red-600">삭제?</span>
                    <button
                      type="button"
                      onClick={() => void confirmDelete(pl.id)}
                      disabled={busy}
                      className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label="삭제 확인"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      disabled={busy}
                      className="rounded p-1 text-(--notion-fg)/50 hover:bg-(--notion-hover) disabled:opacity-50"
                      aria-label="취소"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startRename(pl)}
                      className="rounded p-1 text-(--notion-fg)/50 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                      aria-label="이름 변경"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingId(pl.id);
                        setEditingId(null);
                      }}
                      className="rounded p-1 text-(--notion-fg)/50 hover:bg-red-50 hover:text-red-600"
                      aria-label="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
