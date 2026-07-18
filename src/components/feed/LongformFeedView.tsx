"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Play } from "lucide-react";
import type { FeedItem } from "@/types/feed";
import AddToRadioButton from "./AddToRadioButton";
import BookmarkButton from "./BookmarkButton";
import LongformSummaryPanel from "./LongformSummaryPanel";
import type { BookmarkEntry } from "./FeedClientContainer";

const LONGFORM_SCROLL_KEY = "focus-feed:longform-scroll-y";

interface Props {
  items: FeedItem[];
  initialWatchVideoId?: string | null;
  bookmarks?: BookmarkEntry[];
  onBookmarkChange?: () => void;
}

function formatDuration(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  const value = Math.floor(seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remaining = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatRelativeDate(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "최근";
  const hours = Math.max(0, Math.floor((Date.now() - time) / 3_600_000));
  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(time));
}

function thumbnailFor(item: FeedItem) {
  return item.thumbnail ?? `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`;
}

function saveListPosition() {
  try {
    sessionStorage.setItem(LONGFORM_SCROLL_KEY, String(Math.max(0, Math.round(window.scrollY))));
  } catch {}
}

function restoreListPosition() {
  let position = 0;
  try {
    position = Number(sessionStorage.getItem(LONGFORM_SCROLL_KEY)) || 0;
  } catch {}
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.scrollTo({ top: position, behavior: "auto" }));
  });
}

function ChannelIdentity({ item }: { item: FeedItem }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-(--surface-subtle) text-xs font-bold text-(--text-secondary)">
        {item.sourceAvatarUrl ? (
          <Image src={item.sourceAvatarUrl} alt="" fill sizes="36px" className="object-cover" />
        ) : (
          item.sourceName.slice(0, 2).toUpperCase()
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-(--text-secondary)">{item.sourceName}</span>
        <span className="mt-0.5 block text-xs text-(--text-secondary)">롱폼 · {formatRelativeDate(item.pubDate)}</span>
      </span>
    </span>
  );
}

export default function LongformFeedView({
  items,
  initialWatchVideoId = null,
  bookmarks = [],
  onBookmarkChange,
}: Props) {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(initialWatchVideoId);
  const shouldRestoreListPosition = useRef(false);

  useEffect(() => {
    const handlePopState = () => {
      const nextVideoId = new URLSearchParams(window.location.search).get("watch");
      shouldRestoreListPosition.current = !nextVideoId;
      setSelectedVideoId(nextVideoId);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (selectedVideoId || !shouldRestoreListPosition.current) return;
    shouldRestoreListPosition.current = false;
    restoreListPosition();
  }, [selectedVideoId]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedVideoId) ?? null,
    [items, selectedVideoId],
  );

  const openVideo = useCallback((videoId: string, replace = false) => {
    if (!selectedVideoId) saveListPosition();
    const url = new URL(window.location.href);
    url.searchParams.set("viewMode", "longform");
    url.searchParams.set("watch", videoId);
    const nextState = { ...window.history.state, focusFeedLongformWatch: true };
    if (replace) window.history.replaceState(nextState, "", url);
    else window.history.pushState(nextState, "", url);
    setSelectedVideoId(videoId);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedVideoId]);

  const closeVideo = useCallback(() => {
    if (window.history.state?.focusFeedLongformWatch) {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("watch");
    window.history.replaceState(window.history.state, "", url);
    shouldRestoreListPosition.current = true;
    setSelectedVideoId(null);
  }, []);

  if (selectedItem) {
    const bookmark = bookmarks.find((entry) => entry.video_id === selectedItem.id) ?? null;
    const relatedItems = items.filter((item) => item.id !== selectedItem.id).slice(0, 8);
    return (
      <section data-testid="longform-watch" className="mx-auto w-full max-w-[1600px] pb-28 pt-2 sm:pt-4">
        <button
          type="button"
          onClick={closeVideo}
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-(--border-subtle) bg-(--surface-raised) px-4 text-sm font-semibold text-(--text-primary) transition-colors hover:bg-(--surface-subtle) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/35"
        >
          <ArrowLeft size={18} aria-hidden />
          동영상 목록
        </button>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div data-testid="longform-player" className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-[0_18px_50px_rgba(15,23,42,0.16)] sm:rounded-3xl">
              <iframe
                title={selectedItem.title}
                src={`https://www.youtube.com/embed/${selectedItem.id}?autoplay=0&rel=0&modestbranding=1`}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className="px-1 pt-5 sm:px-2">
              <h1 className="m-0! text-xl! font-bold leading-snug! tracking-[-0.035em] text-(--text-primary) sm:text-2xl! lg:text-[28px]!">
                {selectedItem.title}
              </h1>
              <div className="mt-4 flex flex-col gap-4 border-b border-(--border-subtle) pb-5 sm:flex-row sm:items-center sm:justify-between">
                <ChannelIdentity item={selectedItem} />
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={selectedItem.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-(--border-subtle) px-4 text-sm font-semibold text-(--text-primary) hover:bg-(--surface-subtle)"
                  >
                    <ExternalLink size={17} aria-hidden /> 원문
                  </a>
                  <AddToRadioButton
                    videoId={selectedItem.id}
                    title={selectedItem.title}
                    className="min-h-11 px-4 text-sm"
                  />
                  {onBookmarkChange && (
                    <BookmarkButton
                      videoId={selectedItem.id}
                      videoTitle={selectedItem.title}
                      highlight={selectedItem.title}
                      isBookmarked={!!bookmark}
                      bookmarkId={bookmark?.id ?? null}
                      onBookmarkChange={onBookmarkChange}
                      className="h-11 w-11 border border-(--border-subtle)"
                      iconSize={20}
                    />
                  )}
                </div>
              </div>

              <LongformSummaryPanel key={selectedItem.id} videoId={selectedItem.id} />
            </div>
          </div>

          <aside aria-label="관련 동영상" className="rounded-2xl border border-(--border-subtle) bg-(--surface-raised) p-3 sm:p-4">
            <h2 className="m-0! px-1 text-base! font-bold text-(--text-primary)">다음에 볼 영상</h2>
            <div className="mt-3 space-y-3">
              {relatedItems.map((item) => {
                const duration = formatDuration(item.durationSeconds);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openVideo(item.id, true)}
                    className="grid w-full grid-cols-[136px_minmax(0,1fr)] gap-3 rounded-xl p-1 text-left transition-colors hover:bg-(--surface-subtle) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/35"
                  >
                    <span className="relative aspect-video overflow-hidden rounded-lg bg-black">
                      <Image src={thumbnailFor(item)} alt="" fill sizes="136px" className="object-cover" />
                      {duration && <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{duration}</span>}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="line-clamp-2 text-sm font-semibold leading-snug text-(--text-primary)">{item.title}</span>
                      <span className="mt-1 block truncate text-xs text-(--text-secondary)">{item.sourceName}</span>
                      <span className="mt-0.5 block text-[11px] text-(--text-secondary)">{formatRelativeDate(item.pubDate)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="longform-list" className="mx-auto w-full max-w-[1600px] pb-28 pt-2 sm:pt-5">
      <div className="mb-6 flex items-end justify-between gap-4 px-1 sm:mb-7">
        <div>
          <p className="m-0 text-xs font-extrabold uppercase tracking-[0.12em] text-(--text-secondary)">Longform</p>
          <h1 className="mb-0! mt-1! text-2xl! font-bold tracking-[-0.04em] text-(--text-primary) sm:text-3xl!">최신 동영상</h1>
          <p className="mb-0 mt-1 text-sm text-(--text-secondary)">61초 이상의 영상을 골라 상세 화면에서 시청하세요.</p>
        </div>
        <span className="shrink-0 rounded-full bg-(--surface-subtle) px-3 py-1.5 text-xs font-semibold text-(--text-secondary)">최신순</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-(--border-subtle) px-5 py-20 text-center text-sm text-(--text-secondary)">
          표시할 롱폼 동영상이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((item) => {
            const duration = formatDuration(item.durationSeconds);
            return (
              <button
                key={item.id}
                type="button"
                data-testid="longform-card"
                onClick={() => openVideo(item.id)}
                className="group min-w-0 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/35 focus-visible:ring-offset-4 focus-visible:ring-offset-(--surface-canvas)"
                aria-label={`${item.title} 상세 재생`}
              >
                <span className="relative block aspect-video overflow-hidden rounded-2xl bg-black sm:rounded-[18px]">
                  <Image
                    src={thumbnailFor(item)}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover transition-transform duration-200 group-hover:scale-[1.025]"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/10">
                    <span className="grid size-12 scale-90 place-items-center rounded-full bg-black/72 text-white opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
                      <Play size={20} fill="currentColor" className="ml-0.5" aria-hidden />
                    </span>
                  </span>
                  {duration && <span className="absolute bottom-2 right-2 rounded-md bg-black/82 px-1.5 py-0.5 text-[11px] font-bold text-white">{duration}</span>}
                </span>
                <span className="mt-3 grid grid-cols-[36px_minmax(0,1fr)] gap-3 px-0.5">
                  <span className="relative grid size-9 place-items-center overflow-hidden rounded-full bg-(--surface-subtle) text-[11px] font-bold text-(--text-secondary)">
                    {item.sourceAvatarUrl ? <Image src={item.sourceAvatarUrl} alt="" fill sizes="36px" className="object-cover" /> : item.sourceName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-[1.4] tracking-[-0.02em] text-(--text-primary) sm:text-base">{item.title}</span>
                    <span className="mt-1 block truncate text-sm text-(--text-secondary)">{item.sourceName}</span>
                    <span className="mt-0.5 block text-xs text-(--text-secondary)">롱폼 · {formatRelativeDate(item.pubDate)}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
