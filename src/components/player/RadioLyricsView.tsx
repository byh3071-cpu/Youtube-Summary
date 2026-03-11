import { useState, useCallback } from "react";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { summarizeVideoAction } from "@/app/actions/summarize";
import { qaLog } from "@/lib/qa-log";
import { X, Loader2 } from "lucide-react";

interface RadioLyricsViewProps {
  lyricsOpen: boolean;
  setLyricsOpen: (v: boolean) => void;
}

export function RadioLyricsView({ lyricsOpen, setLyricsOpen }: RadioLyricsViewProps) {
  const radio = useRadioQueueOptional();
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchSummaryForCurrent = useCallback(async () => {
    if (!radio?.currentItem?.videoId || !radio.updateItemSummary) return;
    qaLog.radio.summaryFetchStart(radio.currentItem.videoId);
    setSummaryLoading(true);
    try {
      const result = await summarizeVideoAction(radio.currentItem.videoId);
      if (result.summary) {
        radio.updateItemSummary(radio.currentItem.videoId, result.summary);
        if (typeof window !== "undefined") {
          localStorage.setItem(`summary_${radio.currentItem.videoId}`, result.summary);
        }
        qaLog.radio.summaryFetchSuccess(radio.currentItem.videoId);
      } else if (result.error) {
        qaLog.radio.summaryFetchError(radio.currentItem.videoId, result.error);
      }
    } finally {
      setSummaryLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radio?.currentItem?.videoId, radio?.updateItemSummary]);

  if (!lyricsOpen || !radio) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-55 bg-(--notion-fg)/20"
        aria-hidden
        onClick={() => setLyricsOpen(false)}
      />
      <div
        className="fixed bottom-16 left-4 right-4 z-56 max-h-[50vh] overflow-auto rounded-t-2xl border border-b-0 border-(--notion-border) bg-(--notion-bg) p-4 shadow-2xl md:left-1/2 md:right-auto md:w-full md:max-w-md md:-translate-x-1/2"
        role="dialog"
        aria-label="AI 요약"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-(--notion-fg)">AI 핵심 요약</h3>
          <button
            type="button"
            onClick={() => setLyricsOpen(false)}
            className="rounded-full p-1 text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-[80px] whitespace-pre-wrap rounded-xl border border-(--notion-border) bg-(--notion-gray)/30 px-4 py-3 text-sm leading-relaxed text-(--notion-fg)">
          {radio.currentItem?.summary ? (
            radio.currentItem.summary
          ) : summaryLoading ? (
            <span className="flex items-center gap-2 text-(--notion-fg)/60">
              <Loader2 size={16} className="animate-spin" />
              요약 생성 중…
            </span>
          ) : (
            <button
              type="button"
              onClick={fetchSummaryForCurrent}
              className="rounded-full border border-(--notion-border) bg-(--notion-hover) px-3 py-1.5 text-xs font-medium text-(--notion-fg) hover:bg-(--notion-gray)"
            >
              요약 불러오기
            </button>
          )}
        </div>
      </div>
    </>
  );
}
