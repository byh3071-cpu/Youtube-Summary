"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, Rss, Youtube, Tag, X } from "lucide-react";
import { defaultSources, FEED_CATEGORIES } from "@/lib/sources";
import AddChannelButton from "@/components/feed/AddChannelButton";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

const rssSources = defaultSources.filter((s) => s.type === "RSS");
const youtubeStatusLabel = {
  ready: "정상 연결",
  missing_api_key: "키 필요",
  invalid_api_key: "키 오류",
  request_failed: "일시 장애",
} as const;
const youtubeStatusTone = {
  ready: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  missing_api_key: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  invalid_api_key: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  request_failed: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
} as const;

export default function MobileNavDrawer({
  open,
  onClose,
  sourceStatus,
  selectedSourceId,
  selectedCategory,
  youtubeSources,
}: {
  open: boolean;
  onClose: () => void;
  sourceStatus: MergedFeedResult["sourceStatus"];
  selectedSourceId?: string;
  selectedCategory?: string;
  youtubeSources?: FeedSource[];
}) {
  const ytSources = youtubeSources ?? defaultSources.filter((s) => s.type === "YouTube");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const linkTo = (source?: string, category?: string) => {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (category) params.set("category", category);
    const q = params.toString();
    return q ? `/?${q}` : "/";
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-(--notion-fg)/30 md:hidden"
        aria-hidden
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto border-r border-(--notion-border) bg-(--notion-gray) md:hidden"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-(--notion-border) bg-(--notion-bg) px-4 py-3">
          <span className="text-sm font-semibold text-(--notion-fg)">메뉴</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
            aria-label="메뉴 닫기"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="space-y-6 p-4">
          <div>
            <Link
              href="/"
              onClick={onClose}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${selectedSourceId ? "text-(--notion-fg)/80 hover:bg-(--notion-hover)" : "bg-(--notion-hover) text-(--notion-fg)"}`}
            >
              <Home size={18} />
              전체 피드
            </Link>
          </div>

          <section>
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
              카테고리
            </p>
            <div className="space-y-0.5">
              <Link
                href="/"
                onClick={onClose}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${!selectedCategory ? "bg-(--notion-hover) font-medium" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
              >
                전체
              </Link>
              {FEED_CATEGORIES.map((cat) => (
                <Link
                  key={cat}
                  href={linkTo(undefined, cat)}
                  onClick={onClose}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${selectedCategory === cat ? "bg-(--notion-hover) font-medium" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
                >
                  {cat}
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
                YouTube ({ytSources.length})
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${youtubeStatusTone[sourceStatus.youtube]}`}>
                {youtubeStatusLabel[sourceStatus.youtube]}
              </span>
            </div>
            <div className="space-y-0.5">
              {ytSources.map((item) => (
                <Link
                  key={item.id}
                  href={linkTo(item.id)}
                  onClick={onClose}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${selectedSourceId === item.id ? "bg-(--notion-hover) font-medium" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
                >
                  <span className="truncate">{item.name}</span>
                </Link>
              ))}
              <div className="pt-1">
                <AddChannelButton />
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
              RSS ({rssSources.length})
            </p>
            <div className="space-y-0.5">
              {rssSources.map((item) => (
                <Link
                  key={item.id}
                  href={linkTo(item.id)}
                  onClick={onClose}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${selectedSourceId === item.id ? "bg-(--notion-hover) font-medium" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
                >
                  <span className="truncate">{item.name}</span>
                </Link>
              ))}
            </div>
          </section>
        </nav>
      </aside>
    </>
  );
}
