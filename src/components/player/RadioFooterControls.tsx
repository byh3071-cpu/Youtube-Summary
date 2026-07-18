"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ListMusic,
  Maximize2,
  MoreHorizontal,
  Pause,
  PictureInPicture2,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { qaLog } from "@/lib/qa-log";

interface RadioFooterControlsProps {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  lyricsOpen: boolean;
  setLyricsOpen: (v: boolean) => void;
  videoExpanded: boolean;
  setVideoExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  setFullPlayerOpen: (v: boolean) => void;
  togglePlay: () => void;
  progress: number;
  onSeek?: (percent: number) => void;
}

export function RadioFooterControls({
  drawerOpen,
  setDrawerOpen,
  lyricsOpen,
  setLyricsOpen,
  videoExpanded,
  setVideoExpanded,
  setFullPlayerOpen,
  togglePlay,
  progress = 0,
  onSeek,
}: RadioFooterControlsProps) {
  const radio = useRadioQueueOptional();
  const mobileBarRef = useRef<HTMLDivElement>(null);
  const desktopBarRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMoreRef = useRef<HTMLButtonElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const clampedProgress = Math.max(0, Math.min(100, progress));

  const visibleSeekBar = useCallback(() => {
    return [mobileBarRef.current, desktopBarRef.current].find((element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ?? null;
  }, []);

  const percentFromEvent = useCallback(
    (event: { clientX: number }) => {
      const element = visibleSeekBar();
      if (!element) return 0;
      const rect = element.getBoundingClientRect();
      return Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    },
    [visibleSeekBar],
  );

  const handleBarClick = useCallback(
    (event: React.MouseEvent) => {
      if (!onSeek) return;
      if ((event.target as HTMLElement).closest?.("[data-seek-thumb]")) return;
      event.preventDefault();
      event.stopPropagation();
      onSeek(percentFromEvent(event));
    },
    [onSeek, percentFromEvent],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!onSeek) return;
      event.preventDefault();
      event.stopPropagation();
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      setIsDragging(true);
      onSeek(percentFromEvent(event));
    },
    [onSeek, percentFromEvent],
  );

  const handleSeekKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!onSeek) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 5 : -5;
      onSeek(Math.max(0, Math.min(100, clampedProgress + delta)));
    },
    [clampedProgress, onSeek],
  );

  useEffect(() => {
    if (!isDragging || !onSeek) return;
    const onMove = (event: PointerEvent) => onSeek(percentFromEvent(event));
    const onUp = () => setIsDragging(false);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [isDragging, onSeek, percentFromEvent]);

  useEffect(() => {
    if (!mobileActionsOpen) return;
    requestAnimationFrame(() => {
      mobileMenuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    });
    const closeAndRestore = () => {
      setMobileActionsOpen(false);
      requestAnimationFrame(() => mobileMoreRef.current?.focus());
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAndRestore();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (mobileMenuRef.current?.contains(target) || mobileMoreRef.current?.contains(target)) return;
      setMobileActionsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [mobileActionsOpen]);

  if (!radio || !radio.currentItem) return null;

  const thumbnail = `https://i.ytimg.com/vi/${encodeURIComponent(radio.currentItem.videoId)}/mqdefault.jpg`;
  const atFirst = radio.currentIndex <= 0;
  const atLast = radio.currentIndex >= radio.queue.length - 1;
  const iconButton =
    "inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-(--text-secondary) transition-colors hover:bg-(--surface-subtle) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/45 disabled:cursor-not-allowed disabled:opacity-35";
  const playButton =
    "inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-(--playback-accent) text-black shadow-[0_5px_18px_rgba(16,185,129,0.24)] transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface-raised)";

  const toggleDrawer = () => {
    const next = !drawerOpen;
    setDrawerOpen(next);
    if (next) qaLog.radio.playlistDrawerOpen(radio.queue.length);
    else qaLog.radio.playlistDrawerClose();
  };

  const toggleLyrics = () => {
    const next = !lyricsOpen;
    setLyricsOpen(next);
    if (next) qaLog.radio.lyricsViewOpen(!!radio.currentItem?.summary);
    else qaLog.radio.lyricsViewClose();
  };

  const toggleVideo = () => {
    setVideoExpanded((expanded) => {
      const next = !expanded;
      if (next) qaLog.radio.videoExpandOn();
      else qaLog.radio.videoExpandOff();
      return next;
    });
  };

  const openFullPlayer = () => {
    setFullPlayerOpen(true);
    qaLog.radio.fullPlayerOpen();
  };

  const renderProgress = (
    ref: React.RefObject<HTMLDivElement | null>,
    compact = false,
  ) => (
    <div
      ref={ref}
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "재생 위치" : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedProgress)}
      tabIndex={onSeek ? 0 : undefined}
      onClick={onSeek ? handleBarClick : undefined}
      onKeyDown={onSeek ? handleSeekKeyDown : undefined}
      className={`relative flex w-full items-center overflow-visible ${compact ? "h-3" : "h-4"} ${onSeek ? "cursor-pointer touch-none" : ""}`}
    >
      <div className={`relative w-full overflow-hidden rounded-full bg-(--surface-subtle) ${compact ? "h-1" : "h-1.5"}`}>
        <div
          className="h-full rounded-full bg-(--playback-accent)"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {!compact && clampedProgress > 0 && clampedProgress < 100 && (
        <div
          data-seek-thumb
          className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--playback-accent) shadow-sm ring-2 ring-(--surface-raised) ${onSeek ? "pointer-events-auto cursor-grab touch-none active:cursor-grabbing" : "pointer-events-none"}`}
          style={{ left: `${clampedProgress}%` }}
          onPointerDown={onSeek ? handlePointerDown : undefined}
          aria-hidden
        />
      )}
    </div>
  );

  const mobileMenuAction =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-(--text-primary) hover:bg-(--surface-subtle) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/35";

  return (
    <footer
      data-testid="radio-player"
      className="scroll-lock-stable-full fixed inset-x-0 bottom-0 z-50 border-t border-(--border-subtle) bg-(--surface-raised)/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl"
      aria-label="라디오 플레이어"
    >
      <div className="relative md:hidden">
        <div className="absolute inset-x-0 top-0 z-[1]">{renderProgress(mobileBarRef, true)}</div>
        <div className="flex h-20 items-center gap-1.5 px-3 pt-1">
          <button
            type="button"
            onClick={toggleDrawer}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/35"
            aria-label="재생 대기열 열기"
          >
            <span className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl bg-(--surface-subtle)">
              <Image src={thumbnail} alt="" fill sizes="52px" className="object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-(--text-primary)">{radio.currentItem.title}</span>
              <span className="mt-0.5 block text-[11px] text-(--text-secondary)">라디오 · {radio.currentIndex + 1}/{radio.queue.length}</span>
            </span>
          </button>
          <button type="button" onClick={togglePlay} className={`${playButton} !h-12 !w-12 !min-h-12 !min-w-12`} aria-label={radio.isPlaying ? "일시정지" : "재생"}>
            {radio.isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="ml-0.5" />}
          </button>
          <button type="button" onClick={() => radio.next()} disabled={atLast} className={iconButton} aria-label="다음 곡">
            <SkipForward size={19} fill="currentColor" />
          </button>
          <button
            ref={mobileMoreRef}
            type="button"
            onClick={() => setMobileActionsOpen((open) => !open)}
            className={iconButton}
            aria-label="플레이어 더보기"
            aria-expanded={mobileActionsOpen}
            aria-controls="mobile-player-actions"
          >
            <MoreHorizontal size={21} />
          </button>
        </div>

        {mobileActionsOpen && (
          <div
            ref={mobileMenuRef}
            id="mobile-player-actions"
            data-testid="mobile-player-actions"
            role="menu"
            className="absolute bottom-[calc(100%+0.5rem)] right-2 z-[2] w-60 rounded-2xl border border-(--border-subtle) bg-(--surface-raised) p-2 shadow-[var(--shadow-lg)]"
          >
            <button type="button" role="menuitem" disabled={atFirst} onClick={() => { radio.prev(); setMobileActionsOpen(false); }} className={mobileMenuAction}>
              <SkipBack size={18} /> 이전 영상
            </button>
            <button type="button" role="menuitem" onClick={() => { toggleDrawer(); setMobileActionsOpen(false); }} className={mobileMenuAction}>
              <ListMusic size={18} /> 재생 대기열
            </button>
            <button type="button" role="menuitem" onClick={() => { toggleLyrics(); setMobileActionsOpen(false); }} className={mobileMenuAction}>
              <Sparkles size={18} className="text-(--ai-accent)" /> AI 요약
            </button>
            <button type="button" role="menuitem" onClick={() => { toggleVideo(); setMobileActionsOpen(false); }} className={mobileMenuAction}>
              <PictureInPicture2 size={18} /> {videoExpanded ? "미니 영상 닫기" : "미니 영상"}
            </button>
            <button type="button" role="menuitem" onClick={() => { openFullPlayer(); setMobileActionsOpen(false); }} className={mobileMenuAction}>
              <Maximize2 size={18} /> 전체 화면
            </button>
            <button type="button" role="menuitem" onClick={() => radio.close()} className={`${mobileMenuAction} text-red-600 dark:text-red-400`}>
              <X size={18} /> 플레이어 닫기
            </button>
          </div>
        )}
      </div>

      <div className="mx-auto hidden min-h-[84px] max-w-screen-2xl grid-cols-[minmax(0,1fr)_minmax(260px,1.1fr)_minmax(0,1fr)] items-center gap-5 px-5 py-3 md:grid lg:px-7">
        <button
          type="button"
          onClick={toggleDrawer}
          className="flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/35"
          aria-label="재생 대기열 열기"
        >
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-(--surface-subtle)">
            <Image src={thumbnail} alt="" fill sizes="56px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-(--text-primary)">{radio.currentItem.title}</span>
            <span className="mt-1 block text-xs text-(--text-secondary)">라디오 · {radio.currentIndex + 1}/{radio.queue.length}</span>
          </span>
        </button>

        <div className="min-w-0">
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => radio.prev()} disabled={atFirst} className={iconButton} aria-label="이전 곡">
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button type="button" onClick={togglePlay} className={playButton} aria-label={radio.isPlaying ? "일시정지" : "재생"}>
              {radio.isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="ml-0.5" />}
            </button>
            <button type="button" onClick={() => radio.next()} disabled={atLast} className={iconButton} aria-label="다음 곡">
              <SkipForward size={18} fill="currentColor" />
            </button>
          </div>
          <div className="mt-1">{renderProgress(desktopBarRef)}</div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1">
          <button type="button" onClick={toggleDrawer} className={`${iconButton} ${drawerOpen ? "bg-(--playback-accent-muted) text-(--playback-accent)" : ""}`} aria-label="재생 목록" aria-pressed={drawerOpen}>
            <ListMusic size={19} />
          </button>
          <button type="button" onClick={toggleLyrics} className={`${iconButton} ${lyricsOpen ? "bg-(--ai-accent-muted) text-(--ai-accent)" : ""}`} aria-label="AI 요약 보기" aria-pressed={lyricsOpen}>
            <Sparkles size={19} />
          </button>
          <button type="button" onClick={toggleVideo} className={`${iconButton} ${videoExpanded ? "bg-(--playback-accent-muted) text-(--playback-accent)" : ""}`} aria-label={videoExpanded ? "미니 영상 끄기" : "미니 영상 켜기"} aria-pressed={videoExpanded}>
            <PictureInPicture2 size={19} />
          </button>
          <button type="button" onClick={openFullPlayer} className={iconButton} aria-label="전체 화면 영상">
            <Maximize2 size={19} />
          </button>
          <button type="button" onClick={() => radio.close()} className={iconButton} aria-label="플레이어 닫기">
            <X size={19} />
          </button>
        </div>
      </div>
    </footer>
  );
}
