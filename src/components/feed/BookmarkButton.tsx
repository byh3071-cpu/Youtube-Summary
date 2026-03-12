"use client";

import { useEffect, useState } from "react";
import { Bookmark, Loader2 } from "lucide-react";

interface Props {
  videoId: string;
  videoTitle: string;
  highlight?: string;
  isBookmarked: boolean;
  bookmarkId: string | null;
  onBookmarkChange: () => void;
  /** 로그인 안 했을 때 true */
  disabled?: boolean;
}

export default function BookmarkButton({
  videoId,
  videoTitle,
  highlight,
  isBookmarked,
  bookmarkId,
  onBookmarkChange,
  disabled,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [optimisticBookmarked, setOptimisticBookmarked] = useState(isBookmarked);

  useEffect(() => {
    setOptimisticBookmarked(isBookmarked);
  }, [isBookmarked]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || loading) return;
    setLoading(true);
    const prev = optimisticBookmarked;
    setOptimisticBookmarked(!prev);
    try {
      if (isBookmarked && bookmarkId) {
        const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(bookmarkId)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          onBookmarkChange();
        } else if (res.status === 401) {
          setOptimisticBookmarked(prev);
          alert("로그인이 필요합니다.");
        } else {
          setOptimisticBookmarked(prev);
        }
      } else {
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_id: videoId,
            video_title: videoTitle,
            highlight: highlight ?? videoTitle,
          }),
        });
        if (res.ok) {
          onBookmarkChange();
        } else if (res.status === 401) {
          setOptimisticBookmarked(prev);
          alert("로그인이 필요합니다.");
        } else if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setOptimisticBookmarked(prev);
          alert(data?.error ?? "북마크 저장에 실패했습니다.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (disabled) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
        optimisticBookmarked
          ? "text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
          : "text-(--notion-fg)/50 hover:bg-(--notion-hover) hover:text-(--notion-fg)/70"
      }`}
      aria-label={isBookmarked ? "북마크 해제" : "북마크 추가"}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin text-(--notion-fg)/60" />
      ) : (
        <Bookmark
          size={16}
          className={isBookmarked ? "fill-current" : ""}
        />
      )}
    </button>
  );
}
