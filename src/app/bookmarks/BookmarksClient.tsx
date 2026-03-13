"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bookmark, Trash2, ExternalLink, Headphones, Rss } from "lucide-react";
import type { BookmarkRow } from "@/lib/supabase-server-cookies";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";

const RSS_BOOKMARK_PREFIX = "rss:";

function isRssBookmark(b: BookmarkRow) {
  return b.video_id.startsWith(RSS_BOOKMARK_PREFIX);
}

function rssArticleUrl(videoId: string) {
  return videoId.startsWith(RSS_BOOKMARK_PREFIX) ? videoId.slice(RSS_BOOKMARK_PREFIX.length) : "";
}

type FilterMode = "all" | "youtube" | "rss";

export default function BookmarksClient({ bookmarks }: { bookmarks: BookmarkRow[] }) {
  const [list, setList] = useState(bookmarks);
  const [filter, setFilter] = useState<FilterMode>("all");
  const radio = useRadioQueueOptional();

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setList((prev) => prev.filter((b) => b.id !== id));
  };

  const handlePlayInRadio = (b: BookmarkRow) => {
    if (!radio || isRssBookmark(b)) return;
    radio.replaceQueue([
      {
        videoId: b.video_id,
        title: b.video_title,
        summary: b.highlight || undefined,
      },
    ]);
  };

  const filtered = list.filter((b) => {
    if (filter === "youtube") return !isRssBookmark(b);
    if (filter === "rss") return isRssBookmark(b);
    return true;
  });

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-(--notion-border) bg-(--notion-gray)/30 py-12 text-center">
        <Bookmark className="mx-auto mb-3 h-10 w-10 text-(--notion-fg)/30" />
        <p className="text-sm text-(--notion-fg)/60">저장한 북마크가 없습니다.</p>
        <p className="mt-1 text-xs text-(--notion-fg)/45">피드에서 북마크 아이콘을 눌러 저장해 보세요.</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-(--notion-fg)/80 underline hover:text-(--notion-fg)"
        >
          피드로 가기
        </Link>
      </div>
    );
  }

  const youtubeWatchUrl = (videoId: string) =>
    `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

  const youtubeThumbUrl = (videoId: string) =>
    `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;

  return (
    <>
      <div className="mb-4 inline-flex rounded-full border border-(--notion-border) bg-(--notion-bg) p-1 text-xs">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${
            filter === "all" ? "bg-(--notion-fg) text-(--notion-bg)" : "text-(--notion-fg)/65 hover:bg-(--notion-hover)"
          }`}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => setFilter("youtube")}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${
            filter === "youtube"
              ? "bg-(--notion-fg) text-(--notion-bg)"
              : "text-(--notion-fg)/65 hover:bg-(--notion-hover)"
          }`}
        >
          YouTube
        </button>
        <button
          type="button"
          onClick={() => setFilter("rss")}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${
            filter === "rss"
              ? "bg-(--notion-fg) text-(--notion-bg)"
              : "text-(--notion-fg)/65 hover:bg-(--notion-hover)"
          }`}
        >
          RSS·뉴스
        </button>
      </div>

      <ul className="space-y-3">
        {filtered.map((b) => {
        const rss = isRssBookmark(b);
        const articleUrl = rss ? rssArticleUrl(b.video_id) : "";
        return (
          <li
            key={b.id}
            className="flex items-stretch gap-3 rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4"
          >
            {rss ? (
              <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Rss size={28} />
              </div>
            ) : (
              <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-(--notion-gray)">
                <Image
                  src={youtubeThumbUrl(b.video_id)}
                  alt={b.video_title}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-(--notion-fg) line-clamp-2">{b.video_title}</p>
              {b.highlight && b.highlight !== b.video_title && (
                <p className="mt-1 text-xs text-(--notion-fg)/65 line-clamp-3">
                  <span className="mr-1 rounded-full bg-(--notion-gray)/40 px-1.5 py-0.5 text-[10px] font-semibold text-(--notion-fg)/70">
                    {rss ? "요약" : "AI 메모"}
                  </span>
                  {b.highlight}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <a
                  href={rss ? articleUrl : youtubeWatchUrl(b.video_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-(--notion-border) bg-(--notion-bg) px-2 py-1 font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
                >
                  <ExternalLink size={12} />
                  {rss ? "원문 보기" : "영상 원문 보기"}
                </a>
                {!rss && (
                  <button
                    type="button"
                    onClick={() => handlePlayInRadio(b)}
                    className="inline-flex items-center gap-1 rounded-full bg-(--notion-fg) px-2 py-1 font-semibold text-(--notion-bg) hover:bg-(--notion-fg)/90"
                  >
                    <Headphones size={12} />
                    라디오로 듣기
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(b.id)}
              className="self-start shrink-0 rounded p-2 text-(--notion-fg)/40 hover:bg-(--notion-hover) hover:text-red-600"
              aria-label="북마크 삭제"
            >
              <Trash2 size={18} />
            </button>
          </li>
        );
      })}
      </ul>
    </>
  );
}
