"use client";

import { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ExternalLink, ChevronDown, Loader2 } from "lucide-react";
import type { FeedItem } from "@/types/feed";
import AddToRadioButton from "./AddToRadioButton";
import BookmarkButton from "./BookmarkButton";
import ReelContextBar from "./ReelContextBar";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import type { BookmarkEntry } from "./FeedClientContainer";
import {
  REEL_PLAYBACK_POLICY,
  parseStoredReelPosition,
  reelPositionStorageKey,
  resolveStoredReelIndex,
  type ReelViewMode,
} from "@/lib/reel-playback-policy";
import { useIsHydrated } from "@/lib/use-is-hydrated";

const RSS_BOOKMARK_PREFIX = "rss:";

const reelItemKey = (item: FeedItem) => `${item.source}:${item.sourceId}:${item.id ?? item.link}`;

/** Window.YT 타입은 FloatingRadioPlayer의 전역 선언 사용 */

interface Props {
  items: FeedItem[];
  viewMode: ReelViewMode;
  initialVideoId?: string | null;
  bookmarks?: BookmarkEntry[];
  onBookmarkChange?: () => void;
}

type ReelPlayer = {
  playVideo?: () => void;
  pauseVideo?: () => void;
  mute?: () => void;
  isMuted?: () => boolean;
};

type ReelPlayerState = "idle" | "ready" | "playing" | "paused" | "ended" | "error";

function ReelSlide({
  item,
  viewMode,
  index,
  total,
  bookmark,
  onBookmarkChange,
  onVideoEnd,
  scrollRoot,
  ytReady,
}: {
  item: FeedItem;
  viewMode: ReelViewMode;
  index: number;
  total: number;
  bookmark?: BookmarkEntry | null;
  onBookmarkChange?: () => void;
  onVideoEnd?: () => void;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  ytReady: boolean;
}) {
  const radio = useRadioQueueOptional();
  // 라디오 플레이어(모바일 fixed bottom bar)가 떠 있으면 마지막 슬라이드 버튼바를 가린다 →
  // 하단 spacer를 키워 액션바를 플레이어 위로 밀어올린다.
  const radioActive = !!radio && radio.queue.length > 0;
  // 좌/우 북마크 버튼 공용 (44px 터치 타깃)
  const bookmarkBtnClass = "h-11 w-11 min-h-[44px] min-w-[44px] shrink-0";
  const isYoutube = item.source === "YouTube";
  const isShortform = viewMode === "shortform";
  const isLive = viewMode === "live";
  const playbackPolicy = REEL_PLAYBACK_POLICY[viewMode];
  const videoId = isYoutube && item.id ? item.id : null;
  // 폴백은 16:9 무레터박스 소스(maxresdefault). hqdefault(4:3)는 검은띠가 구워져 있어 contain 시 이중 레터박스가 생김.
  const thumbUrl = item.thumbnail ?? (videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : "");
  const sectionRef = useRef<HTMLElement>(null);
  const playerRef = useRef<ReelPlayer | null>(null);
  const playerCreatedRef = useRef(false);
  const inViewRef = useRef(false);
  const [inView, setInView] = useState(false);
  const [playerMounted, setPlayerMounted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<ReelPlayerState>("idle");
  const playerId = `reel-yt-${index}`;

  const startPlayback = useCallback((player: ReelPlayer) => {
    if (isShortform) player.mute?.();
    player.playVideo?.();
  }, [isShortform]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !scrollRoot.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e) setInView(e.isIntersecting && e.intersectionRatio >= 0.4);
      },
      { threshold: [0.2, 0.4, 0.6], root: scrollRoot.current, rootMargin: "0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    inViewRef.current = inView;
    if (!playerRef.current) return;
    try {
      if (inView && playbackPolicy.autoplay) startPlayback(playerRef.current);
      else if (!inView) playerRef.current.pauseVideo?.();
    } catch {}
  }, [inView, playbackPolicy.autoplay, startPlayback]);

  useEffect(() => {
    if (!inView || !videoId || !ytReady || typeof window === "undefined") return;
    if (playerCreatedRef.current) return;
    const YT = window.YT;
    if (!YT?.Player) return;
    const el = document.getElementById(playerId);
    if (!el) return;
    playerCreatedRef.current = true;
    try {
      const player = new YT.Player(playerId, {
        height: "100%",
        width: "100%",
        videoId,
        playerVars: {
          autoplay: playbackPolicy.autoplay ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady(ev: { target: ReelPlayer }) {
            setPlayerMounted(true);
            setPlayerReady(true);
            setPlayerState("ready");
            if (inViewRef.current && playbackPolicy.autoplay) {
              try { startPlayback(ev.target); } catch {}
            }
          },
          onError() {
            setPlayerReady(false);
            setPlayerState("error");
          },
          onStateChange(ev: { data: number }) {
            if (
              ev.data === YT.PlayerState?.PLAYING ||
              ev.data === YT.PlayerState?.PAUSED ||
              ev.data === YT.PlayerState?.CUED
            ) setPlayerReady(true);
            if (ev.data === YT.PlayerState?.PLAYING) setPlayerState("playing");
            else if (ev.data === YT.PlayerState?.PAUSED) setPlayerState("paused");
            else if (ev.data === YT.PlayerState?.CUED) setPlayerState("ready");
            else if (ev.data === YT.PlayerState?.ENDED) {
              setPlayerState("ended");
              if (playbackPolicy.advanceOnEnd) onVideoEnd?.();
            }
          },
        },
      });
      playerRef.current = player as unknown as ReelPlayer;
    } catch {
      playerRef.current = null;
      playerCreatedRef.current = false;
    }
  }, [inView, videoId, playerId, onVideoEnd, playbackPolicy.advanceOnEnd, playbackPolicy.autoplay, startPlayback, ytReady]);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.pauseVideo?.();
      } catch {}
      playerRef.current = null;
      playerCreatedRef.current = false;
    };
  }, []);

  const showPlayer = inView && videoId;
  const useApiPlayer = !!videoId && playerMounted;

  const renderMedia = () => (
    <>
      {thumbUrl ? (
        <Image
          src={thumbUrl}
          alt=""
          fill
          sizes={isShortform ? "(max-width: 768px) 100vw, 550px" : "(max-width: 1024px) 100vw, 1152px"}
          className={`z-0 object-contain transition-opacity duration-200 motion-reduce:transition-none ${useApiPlayer && playerReady ? "opacity-0" : "opacity-100"}`}
          priority={index < 3}
        />
      ) : null}
      {videoId ? (
        <div
          data-testid="youtube-player-surface"
          className="absolute inset-0 z-10 h-full w-full transition-opacity duration-200 motion-reduce:transition-none"
          style={{ opacity: useApiPlayer && playerReady ? 1 : 0 }}
          aria-hidden={!useApiPlayer || !playerReady}
        >
          <div id={playerId} className="h-full w-full" />
        </div>
      ) : null}
      {showPlayer && !playerReady ? (
        <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center" aria-label="영상 불러오는 중">
          <span className="grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            <Loader2 size={22} className="animate-spin" aria-hidden />
          </span>
        </span>
      ) : null}
      {!showPlayer && !useApiPlayer ? (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 block h-full w-full"
            aria-label={`${item.title} 원문 보기`}
          >
            {!thumbUrl ? (
              <div className="flex h-full min-h-[12rem] w-full items-center justify-center text-sm text-white/40">
                썸네일 없음
              </div>
            ) : null}
          </a>
      ) : null}
    </>
  );

  const bookmarkControl = item.source === "RSS" && onBookmarkChange ? (
    <BookmarkButton
      videoId={`${RSS_BOOKMARK_PREFIX}${item.link}`}
      videoTitle={item.title}
      highlight={item.summary ?? item.title}
      isBookmarked={!!bookmark}
      bookmarkId={bookmark?.id ?? null}
      onBookmarkChange={onBookmarkChange}
      className={bookmarkBtnClass}
      iconSize={24}
    />
  ) : isYoutube && item.id && onBookmarkChange ? (
    <BookmarkButton
      videoId={item.id}
      videoTitle={item.title}
      highlight={item.title}
      isBookmarked={!!bookmark}
      bookmarkId={bookmark?.id ?? null}
      onBookmarkChange={onBookmarkChange}
      className={bookmarkBtnClass}
      iconSize={24}
    />
  ) : null;

  return (
    <section
      ref={sectionRef}
      className="relative flex h-full min-h-0 w-full shrink-0 snap-start snap-always flex-col items-center justify-start bg-black px-0 py-0"
      aria-label={`${index + 1} / ${total}`}
      data-testid="reel-slide"
      data-reel-mode={viewMode}
      data-item-key={reelItemKey(item)}
    >
      {isShortform ? (
        <div
          className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-black ${
            radioActive ? "pb-[calc(6rem+env(safe-area-inset-bottom,0px))]" : ""
          }`}
        >
          <div className="flex min-h-0 w-full flex-1 items-center justify-center bg-black">
            <div
              data-testid="reel-media"
              data-player-mounted={playerMounted ? "true" : "false"}
              data-player-ready={playerReady ? "true" : "false"}
              data-player-state={playerState}
              data-autoplay-muted={isShortform ? "true" : "false"}
              className="relative max-h-full max-w-full overflow-hidden bg-black sm:rounded-2xl"
              style={{ height: "min(100%, calc(100vw * 16 / 9))", aspectRatio: "9 / 16" }}
            >
              {renderMedia()}
            </div>
          </div>
          <div
            data-testid="shortform-meta"
            className="w-full shrink-0 border-t border-white/10 bg-black px-4 py-2.5 text-white"
          >
            <div className="mx-auto flex max-w-[440px] items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-white/65">{item.sourceName}</p>
                <h2 className="m-0! mt-0.5! line-clamp-1 text-sm! font-semibold leading-5! text-white">
                  {item.title}
                </h2>
              </div>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/70">
                {index + 1} / {total}
              </span>
            </div>
          </div>
          <div
            data-testid="reel-actions"
            aria-label="Focus Feed 영상 작업"
            className="flex h-14 w-full shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-black px-4"
          >
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="원문 보기"
              title="원문 보기"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 !text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ExternalLink size={20} />
            </a>
            {isYoutube && item.id && (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white [&_button]:!text-white [&_button]:hover:!bg-white/15">
                <AddToRadioButton videoId={item.id} title={item.title} iconOnly className="!h-11 !w-11" />
              </span>
            )}
            {bookmarkControl && (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white [&_button]:!text-white [&_button]:hover:!bg-white/15">
                {bookmarkControl}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className={`flex h-full min-h-0 w-full flex-col ${isLive ? "bg-(--notion-bg)" : ""}`}>
          <div className={`relative flex min-h-0 w-full items-stretch justify-center bg-black ${isLive ? "shrink-0" : "flex-1"}`}>
            <div
              data-testid="reel-media"
              data-player-mounted={playerMounted ? "true" : "false"}
              data-player-ready={playerReady ? "true" : "false"}
              data-player-state={playerState}
              className={`relative w-full max-w-6xl overflow-hidden bg-black ${isLive ? "aspect-video sm:mt-4 sm:rounded-2xl" : "h-full"}`}
            >
              {renderMedia()}
            </div>
            {!isLive && (
              <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
                {item.sourceName}
              </span>
            )}
          </div>
          {isLive && (
            <div className="w-full max-w-6xl shrink-0 bg-(--notion-bg) px-4 pb-1 pt-4 sm:px-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-400">
                <span className="inline-block size-2 rounded-full bg-red-700 dark:bg-red-400" aria-hidden />
                LIVE
              </div>
              <h2 className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-(--notion-fg) sm:text-lg">
                {item.title}
              </h2>
              <p className="mt-1 truncate text-sm text-(--notion-fg)/70">{item.sourceName}</p>
            </div>
          )}
          <div data-testid="reel-actions" className="flex min-h-[3.5rem] shrink-0 flex-wrap items-center justify-between gap-2 bg-(--notion-bg) px-4 py-3.5 sm:grid sm:grid-cols-3 sm:gap-4">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-(--notion-border) bg-(--notion-bg) px-4 py-2.5 text-sm font-medium text-(--notion-fg)/80 hover:bg-(--notion-hover)"
            >
              <ExternalLink size={18} />
              원문 보기
            </a>
            <div className="flex items-center justify-center">
              {isYoutube && item.id && (
                <AddToRadioButton videoId={item.id} title={item.title} className="gap-2 rounded-full border border-(--notion-border) bg-(--notion-gray)/50 px-4 py-2.5 text-sm font-medium [&_svg]:size-5" />
              )}
            </div>
            <div className="flex items-center justify-end">{bookmarkControl}</div>
          </div>
          {radioActive && (
            <div className="h-[calc(5rem+env(safe-area-inset-bottom,0px))] shrink-0 bg-(--notion-bg)" aria-hidden />
          )}
        </div>
      )}
      {!isShortform && index < total - 1 && (
        <div className={`absolute left-1/2 -translate-x-1/2 ${isLive ? "text-(--notion-fg)/35" : "text-white/60"} ${radioActive ? "bottom-32" : "bottom-20"}`}>
          <ChevronDown size={28} className="animate-bounce" aria-hidden />
        </div>
      )}
    </section>
  );
}

export default function FeedReelView({ items, viewMode, initialVideoId = null, bookmarks = [], onBookmarkChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isHydrated = useIsHydrated();
  const playbackPolicy = REEL_PLAYBACK_POLICY[viewMode];
  const itemKeySignature = items.map(reelItemKey).join("\u001f");
  const [ytReady, setYtReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (ytReady) return;
    if (window.YT?.Player) {
      queueMicrotask(() => setYtReady(true));
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(tag, first);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      setYtReady(true);
    };
    return () => {
      window.onYouTubeIframeAPIReady = prev;
    };
  }, [ytReady]);

  const scrollToNext = useCallback((currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= items.length || !containerRef.current) return;
    const nextSlide = containerRef.current.children[nextIndex] as HTMLElement | undefined;
    if (nextSlide) {
      nextSlide.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [items.length]);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || items.length === 0) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(reelPositionStorageKey(viewMode));
    } catch {}
    const stored = parseStoredReelPosition(raw);
    const requestedIndex = initialVideoId ? items.findIndex((item) => item.id === initialVideoId) : -1;
    const index = requestedIndex >= 0
      ? requestedIndex
      : resolveStoredReelIndex(stored, itemKeySignature.split("\u001f"));
    const restore = () => {
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      root.scrollTop = index * root.clientHeight;
      root.style.scrollBehavior = previousBehavior;
    };
    restore();
    const restoredScrollTop = root.scrollTop;
    const frame = requestAnimationFrame(() => {
      if (Math.abs(root.scrollTop - restoredScrollTop) < 1) restore();
    });
    return () => cancelAnimationFrame(frame);
  }, [initialVideoId, itemKeySignature, items, items.length, viewMode]);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || items.length === 0) return;
    let frame = 0;

    const savePosition = () => {
      frame = 0;
      const index = Math.max(0, Math.min(items.length - 1, Math.round(root.scrollTop / root.clientHeight)));
      const item = items[index];
      if (!item) return;
      try {
        sessionStorage.setItem(
          reelPositionStorageKey(viewMode),
          JSON.stringify({ itemKey: reelItemKey(item), index }),
        );
      } catch {}
    };
    const handleScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(savePosition);
    };

    root.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", savePosition);
    return () => {
      root.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", savePosition);
      if (frame) cancelAnimationFrame(frame);
      savePosition();
    };
  }, [items, viewMode]);

  if (items.length === 0) {
    const emptyLabel =
      viewMode === "live"
        ? "라이브"
        : viewMode === "shortform"
          ? "60초 이하 숏폼"
          : "61초 이상 롱폼";
    return (
      <div className="flex h-[100dvh] min-h-0 w-full flex-col">
        <ReelContextBar viewMode={viewMode} />
        <div data-testid="reel-content" className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-(--notion-border) px-4 py-16 text-center">
          <p className="text-(--notion-fg)/70">{emptyLabel} 영상이 없습니다.</p>
          <p className="mt-1 text-sm text-(--notion-fg)/50">
            {viewMode === "live"
              ? "연결된 채널 중 현재 라이브 중인 영상이 없습니다."
              : "유튜브 피드에 재생 시간 정보가 있으면 여기에서 구분해 표시합니다."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col">
      <ReelContextBar viewMode={viewMode} />
      <div
        ref={containerRef}
        data-testid="reel-content"
        data-hydrated={isHydrated ? "true" : "false"}
        data-autoplay={playbackPolicy.autoplay ? "true" : "false"}
        data-advance-on-end={playbackPolicy.advanceOnEnd ? "true" : "false"}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain snap-y snap-mandatory"
        style={{ scrollBehavior: "smooth" }}
      >
      {items.map((item, index) => {
        const bookmark = item.source === "RSS"
          ? bookmarks.find((b) => b.video_id === RSS_BOOKMARK_PREFIX + item.link)
          : item.id
            ? bookmarks.find((b) => b.video_id === item.id)
            : null;
        return (
          <ReelSlide
            key={reelItemKey(item)}
            item={item}
            viewMode={viewMode}
            index={index}
            total={items.length}
            bookmark={bookmark ?? null}
            onBookmarkChange={onBookmarkChange}
            onVideoEnd={playbackPolicy.advanceOnEnd ? () => scrollToNext(index) : undefined}
            scrollRoot={containerRef}
            ytReady={ytReady}
          />
        );
      })}
      </div>
    </div>
  );
}
