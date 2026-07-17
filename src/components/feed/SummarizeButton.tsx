"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertCircle, Sparkles, PanelRightOpen, X } from "lucide-react";
import { summarizeVideoAction } from "@/app/actions/summarize";

interface Props {
  videoId: string;
  /** 그리드 카드처럼 셀 폭이 좁은 곳에서 버튼을 셀 가득 채우고 라벨을 truncate (오버플로 방지) */
  fullWidth?: boolean;
  /** YouTube 카드에서 사용하는 낮은 강조의 보조 액션 */
  compact?: boolean;
}

export default function SummarizeButton({ videoId, fullWidth, compact }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  useEffect(() => {
    const cached = localStorage.getItem(`summary_${videoId}`);
    if (cached) {
      queueMicrotask(() => setSummary(cached));
    }
  }, [videoId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleToggle = async (e: React.MouseEvent) => {
    // 상위 FeedItem의 a 태그 링크 이동 방지
    e.preventDefault(); 
    e.stopPropagation();

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);

    if (summary) {
      return; 
    }

    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await summarizeVideoAction(videoId);

      if (result.error) {
        setError(result.error);
      } else if (result.summary) {
        setSummary(result.summary);
        localStorage.setItem(`summary_${videoId}`, result.summary);
        window.dispatchEvent(new Event("focus-feed:usage-updated"));
      }
    } catch {
      setError("요약 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
      requestInFlight.current = false;
    }
  };

  const buttonClass = compact
    ? "inline-flex min-h-11 min-w-0 justify-self-start items-center gap-1.5 rounded-full border border-(--ai-accent)/20 bg-(--ai-accent)/8 px-3 py-1.5 text-xs font-semibold text-(--ai-accent) transition-colors hover:border-(--ai-accent)/35 hover:bg-(--ai-accent)/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ai-accent)/30"
    : `${fullWidth ? "flex w-full min-w-0 justify-center" : "inline-flex whitespace-nowrap"} min-h-[44px] items-center gap-1.5 rounded-full bg-purple-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 dark:bg-purple-500 dark:hover:bg-purple-600`;

  const summaryPanel = isOpen && typeof document !== "undefined"
    ? createPortal(
        <div className="pointer-events-none fixed inset-0 z-[90]" data-testid="ai-summary-panel-root">
          <button
            type="button"
            aria-label="AI 요약 패널 닫기"
            className="pointer-events-auto absolute inset-0 bg-black/35 backdrop-blur-[2px] sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <aside
            id={`ai-summary-panel-${videoId}`}
            role="dialog"
            aria-label="AI 핵심 요약"
            data-testid="ai-summary-panel"
            className="pointer-events-auto fixed inset-x-0 bottom-0 max-h-[82dvh] min-h-[46dvh] overflow-y-auto rounded-t-[24px] border border-(--border-subtle) bg-(--surface-raised) p-5 shadow-[0_-18px_60px_rgba(0,0,0,0.18)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:min-h-0 sm:w-[400px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:p-6 sm:shadow-[-18px_0_60px_rgba(0,0,0,0.14)]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-(--text-secondary)/25 sm:hidden" aria-hidden />
            <header className="flex items-start justify-between gap-4 border-b border-(--border-subtle) pb-4">
              <div>
                <div className="flex items-center gap-2 text-(--ai-accent)">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-[0.12em]">Focus AI</span>
                </div>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.025em] text-(--text-primary)">핵심 3줄 요약</h2>
                <p className="mt-1 text-xs text-(--text-secondary)">영상을 떠나지 않고 핵심만 먼저 확인하세요.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-(--text-secondary) transition-colors hover:bg-(--surface-subtle) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ai-accent)/35"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="py-5 text-sm leading-7 text-(--text-primary)">
              {loading && (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-(--text-secondary)">
                  <Loader2 className="h-6 w-6 animate-spin text-(--ai-accent)" />
                  <span className="text-[13px] font-medium">AI가 자막을 읽고 핵심 내용을 정리하고 있습니다...</span>
                </div>
              )}
              {error && !loading && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-red-600 dark:text-red-400">
                  <AlertCircle size={17} className="mt-1 shrink-0" />
                  <p className="text-[13px] font-medium leading-6">{error}</p>
                </div>
              )}
              {summary && !loading && (
                <div className="whitespace-pre-wrap break-keep rounded-2xl bg-(--surface-subtle) p-4 text-[14px] leading-7">
                  {summary}
                </div>
              )}
            </div>
          </aside>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
    <div className={compact ? "contents text-sm" : `mt-2.5 text-sm ${fullWidth ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={handleToggle}
        data-testid={compact ? "youtube-card-summary-action" : undefined}
        className={buttonClass}
        aria-expanded={isOpen}
        aria-controls={`ai-summary-panel-${videoId}`}
      >
        <Sparkles size={14} className={`shrink-0 ${compact ? "" : "text-white"} ${loading && !isOpen ? "animate-pulse" : ""}`} />
        <span className={fullWidth || compact ? "truncate" : ""}>
          {compact ? (summary ? "AI 요약 보기" : "AI 요약") : summary ? "AI 핵심 3줄 요약 보기" : "AI 3줄 요약 요청하기"}
        </span>
        <PanelRightOpen size={13} className="hidden shrink-0 opacity-70 sm:block" />
      </button>
    </div>
    {summaryPanel}
    </>
  );
}
