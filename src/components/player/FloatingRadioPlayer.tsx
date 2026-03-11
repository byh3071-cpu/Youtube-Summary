"use client";

/** 하단 고정 라디오 플레이어. YouTube IFrame API, 플레이리스트 서랍·AI 요약 뷰·미니 영상 토글 */
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { qaLog } from "@/lib/qa-log";
import { X } from "lucide-react";
import { RadioFooterControls } from "./RadioFooterControls";
import { RadioPlaylistDrawer } from "./RadioPlaylistDrawer";
import { RadioLyricsView } from "./RadioLyricsView";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace YT {
  class Player {
    constructor(elementId: string, options: {
      height?: string;
      width?: string;
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events?: { onReady?: (event: { target: Player }) => void; onStateChange?: (event: { data: number }) => void };
    });
    loadVideoById(videoId: string): void;
    playVideo(): void;
    pauseVideo(): void;
    getPlayerState(): number;
    getCurrentTime(): number;
    getDuration(): number;
  }
  enum PlayerState {
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
}

const PLAYER_DIV_ID = "yt-radio-player-host";
const PLAYER_WRAPPER_ID = "yt-radio-player-wrapper";

export default function FloatingRadioPlayer() {
  const radio = useRadioQueueOptional();
  const playerRef = useRef<YT.Player | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT?.Player) {
      queueMicrotask(() => setApiReady(true));
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(tag, firstScript);
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      setApiReady(true);
    };
    return () => {
      window.onYouTubeIframeAPIReady = prevReady;
    };
  }, []);

  useEffect(() => {
    if (!apiReady || !radio?.currentItem) return;
    const videoId = radio.currentItem.videoId;
    const isPlaying = radio.isPlaying;
    if (!playerRef.current) {
      playerRef.current = new window.YT.Player(PLAYER_DIV_ID, {
        height: "1",
        width: "1",
        videoId,
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady(ev: { target: YT.Player }) {
            setPlayerReady(true);
            if (radio.isPlaying) ev.target.playVideo();
          },
          onStateChange(ev: { data: number }) {
            if (ev.data === window.YT.PlayerState.ENDED) radio.next();
          },
        },
      });
    } else if (playerReady) {
      if (typeof playerRef.current.loadVideoById === "function") {
        playerRef.current.loadVideoById(videoId);
        if (isPlaying && typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, radio?.currentItem?.videoId, playerReady]);

  useEffect(() => {
    if (!playerRef.current || !radio || !playerReady) return;
    if (radio.isPlaying && typeof playerRef.current.playVideo === "function") {
      playerRef.current.playVideo();
    } else if (!radio.isPlaying && typeof playerRef.current.pauseVideo === "function") {
      playerRef.current.pauseVideo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radio?.isPlaying, playerReady]);

  useEffect(() => {
    if (radio && radio.queue.length === 0) {
      playerRef.current = null;
      setPlayerReady(false);
      setProgress(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radio?.queue.length]);

  // 진행 바 상태 업데이트
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;
    let frameId: number | null = null;

    const update = () => {
      try {
        const current = typeof playerRef.current?.getCurrentTime === "function" ? playerRef.current.getCurrentTime() : 0;
        const duration = typeof playerRef.current?.getDuration === "function" ? playerRef.current.getDuration() : 0;
        if (duration > 0) {
          setProgress(Math.min(100, Math.max(0, (current / duration) * 100)));
        }
      } catch {
        // ignore
      }
      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [playerReady, radio?.currentItem?.videoId]);

  // 미니/전체 영상: YT가 1x1로 만든 iframe을 모드에 맞게 리사이즈
  const MINI_VIDEO_W = 320;
  const MINI_VIDEO_H = 180;
  const videoVisible = videoExpanded || fullPlayerOpen;
  useEffect(() => {
    if (typeof document === "undefined") return;
    const run = () => {
      const wrapper = document.getElementById(PLAYER_WRAPPER_ID);
      const iframe = wrapper?.querySelector?.("iframe") as HTMLIFrameElement | null;
      if (!iframe) return;
      if (fullPlayerOpen) {
        iframe.removeAttribute("width");
        iframe.removeAttribute("height");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
      } else if (videoExpanded) {
        iframe.setAttribute("width", String(MINI_VIDEO_W));
        iframe.setAttribute("height", String(MINI_VIDEO_H));
        iframe.style.width = `${MINI_VIDEO_W}px`;
        iframe.style.height = `${MINI_VIDEO_H}px`;
      } else {
        iframe.setAttribute("width", "1");
        iframe.setAttribute("height", "1");
        iframe.style.width = "1px";
        iframe.style.height = "1px";
      }
    };
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    const t = window.setTimeout(run, 150);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [videoExpanded, fullPlayerOpen]);

  useEffect(() => {
    if (!fullPlayerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFullPlayerOpen(false);
        qaLog.radio.fullPlayerClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullPlayerOpen]);

  const togglePlay = useCallback(() => {
    radio?.togglePlay();
  }, [radio]);

  if (!radio) return null;

  if (radio.queue.length === 0) {
    return (
      <footer
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--notion-border) bg-(--notion-bg)/95 py-3 backdrop-blur supports-backdrop-filter:bg-(--notion-bg)/80"
        role="region"
        aria-label="라디오 안내"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 px-4 md:px-6">
          <div className="relative h-10 w-10 overflow-hidden rounded-lg">
            <Image
              src="/focus-feed-logo-v2.png"
              alt="Focus Feed 로고"
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
          <div className="text-sm">
            <p className="font-medium text-(--notion-fg)">아직 라디오에 담긴 영상이 없어요.</p>
            <p className="text-(--notion-fg)/65">
              피드에서 <span className="font-semibold text-[color:var(--focus-accent)]">라디오에 추가</span>를 눌러 플레이리스트를 채워보세요.
            </p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <>
      {/* 미니: 우하단 320x180 / 전체: 모달 중앙 큰 영상 / 숨김: 1px */}
      <div
        id={PLAYER_WRAPPER_ID}
        className={
          fullPlayerOpen
            ? "fixed inset-0 z-60 flex items-center justify-center bg-black/80 transition-all duration-300 pointer-events-auto"
            : videoExpanded
              ? "fixed bottom-20 right-4 z-60 overflow-hidden rounded-xl border border-(--notion-border) bg-black shadow-lg transition-all duration-300 pointer-events-auto"
              : "pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0"
        }
        style={
          fullPlayerOpen
            ? undefined
            : videoExpanded
              ? { width: MINI_VIDEO_W, height: MINI_VIDEO_H }
              : undefined
        }
        aria-hidden={!videoVisible}
        onClick={
          fullPlayerOpen
            ? () => {
                setFullPlayerOpen(false);
                qaLog.radio.fullPlayerClose();
              }
            : undefined
        }
      >
        <div
          id={PLAYER_DIV_ID}
          className={fullPlayerOpen ? "w-[90vw] max-w-4xl aspect-video overflow-hidden rounded-lg bg-black shadow-2xl" : ""}
          style={
            fullPlayerOpen
              ? { width: "90vw", maxWidth: "896px", aspectRatio: "16/9" }
              : { width: "100%", height: "100%", minWidth: 0, minHeight: 0 }
          }
          aria-hidden={!videoVisible}
          onClick={fullPlayerOpen ? (e) => e.stopPropagation() : undefined}
        />
      </div>
      {fullPlayerOpen && (
        <button
          type="button"
          onClick={() => {
            setFullPlayerOpen(false);
            qaLog.radio.fullPlayerClose();
          }}
          className="fixed top-4 right-4 z-70 flex h-10 w-10 items-center justify-center rounded-full bg-(--notion-fg)/20 text-(--notion-fg) transition-colors hover:bg-(--notion-fg)/30"
          aria-label="전체 화면 닫기"
        >
          <X size={24} />
        </button>
      )}

      <RadioFooterControls
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        lyricsOpen={lyricsOpen}
        setLyricsOpen={setLyricsOpen}
        videoExpanded={videoExpanded}
        setVideoExpanded={setVideoExpanded}
        setFullPlayerOpen={setFullPlayerOpen}
        togglePlay={togglePlay}
        progress={progress}
      />
      
      <RadioPlaylistDrawer
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
      />

      <RadioLyricsView 
        lyricsOpen={lyricsOpen} 
        setLyricsOpen={setLyricsOpen} 
      />
    </>
  );
}
