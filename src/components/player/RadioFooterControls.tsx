import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { qaLog } from "@/lib/qa-log";
import { ChevronLeft, ChevronRight, X, Play, Pause, ListMusic, FileText, Video, Maximize2 } from "lucide-react";

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
}: RadioFooterControlsProps) {
  const radio = useRadioQueueOptional();

  if (!radio) return null;

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--notion-border) bg-(--notion-bg)/95 backdrop-blur supports-backdrop-filter:bg-(--notion-bg)/80"
      role="region"
      aria-label="라디오 플레이어"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 md:px-6">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-(--focus-accent) bg-(--notion-bg) text-(--focus-accent) shadow-sm transition-all hover:scale-105 hover:bg-(--focus-accent) hover:text-white"
          aria-label={radio.isPlaying ? "일시정지" : "재생"}
          title={radio.isPlaying ? "일시정지" : "재생"}
        >
          {radio.isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          type="button"
          onClick={() => radio.prev()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--notion-fg)/70 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          aria-label="이전 곡"
          title="이전 곡"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => radio.next()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--notion-fg)/70 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          aria-label="다음 곡"
          title="다음 곡"
        >
          <ChevronRight size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold text-(--notion-fg)">
            {radio.currentItem?.title ?? "재생 중"}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-(--notion-gray)">
              <div
                className={`h-full rounded-full bg-(--focus-accent) transition-[width] duration-200 ${radio.isPlaying ? "shadow-[0_0_8px_rgba(16,185,129,0.7)]" : ""}`}
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
              {radio.isPlaying && progress > 0 && progress < 100 && (
                <div
                  className="pointer-events-none absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_4px_rgba(15,23,42,0.4)]"
                  style={{ left: `${Math.max(0, Math.min(100, progress))}%`, transform: "translate(-50%, -50%)" }}
                />
              )}
            </div>
            <p className="text-[11px] text-(--notion-fg)/55">
              {radio.currentIndex + 1}/{radio.queue.length}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !drawerOpen;
            setDrawerOpen(next);
            if (next) qaLog.radio.playlistDrawerOpen(radio.queue.length);
            else qaLog.radio.playlistDrawerClose();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--notion-fg)/70 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          aria-label="재생 목록"
          title="재생 목록"
        >
          <ListMusic size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !lyricsOpen;
            setLyricsOpen(next);
            if (next) qaLog.radio.lyricsViewOpen(!!radio.currentItem?.summary);
            else qaLog.radio.lyricsViewClose();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--notion-fg)/70 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          aria-label="AI 요약(가사) 보기"
          title="AI 요약(가사) 보기"
        >
          <FileText size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            setVideoExpanded((e) => {
              const next = !e;
              if (next) qaLog.radio.videoExpandOn();
              else qaLog.radio.videoExpandOff();
              return next;
            });
          }}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-(--notion-hover) ${videoExpanded ? "bg-(--notion-hover) text-(--notion-fg)" : "text-(--notion-fg)/70 hover:text-(--notion-fg)"}`}
          aria-label={videoExpanded ? "미니 영상 끄기" : "미니 영상 켜기"}
          title={videoExpanded ? "미니 영상 끄기" : "미니 영상 켜기"}
        >
          <Video size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            setFullPlayerOpen(true);
            qaLog.radio.fullPlayerOpen();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--notion-fg)/70 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          aria-label="전체 화면 영상"
          title="전체 화면 영상"
        >
          <Maximize2 size={18} />
        </button>
        <button
          type="button"
          onClick={() => radio.close()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--notion-fg)/50 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          aria-label="플레이어 닫기"
          title="플레이어 닫기"
        >
          <X size={18} />
        </button>
      </div>
    </footer>
  );
}
