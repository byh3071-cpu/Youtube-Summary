"use client";

import { useState } from "react";
import { Settings2, X } from "lucide-react";
import { YouTubeFetchStatus } from "@/lib/youtube";

interface ConnectionStatusPopupProps {
  selectedSource?: { id: string; name: string; type: "YouTube" | "RSS" };
  sourceStatus: { youtube: YouTubeFetchStatus; rss: "ready" | "request_failed" };
}

const youtubeStatusLabel: Record<YouTubeFetchStatus, string> = {
  ready: "YouTube 연결됨",
  missing_api_key: "YouTube 키 필요",
  invalid_api_key: "YouTube 키 오류",
  request_failed: "YouTube 일시 장애",
};

const youtubeStatusTone: Record<YouTubeFetchStatus, string> = {
  ready: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  missing_api_key: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  invalid_api_key: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  request_failed: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

export default function ConnectionStatusPopup({
  selectedSource,
  sourceStatus,
}: ConnectionStatusPopupProps) {
  const [open, setOpen] = useState(false);

  const visibleSourceSummary = selectedSource
    ? `${selectedSource.name} 소스만 따로 보고 있습니다.`
    : sourceStatus.youtube !== "ready"
      ? "현재 RSS 소스만 피드에 반영되고 있습니다."
      : "현재 YouTube와 RSS 소스가 모두 피드에 반영되고 있습니다.";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-(--notion-fg)/45 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)/70"
        aria-label="연결 상태 보기"
        title="연결 상태"
      >
        <Settings2 size={14} />
        <span className="hidden sm:inline">연결 상태</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-(--notion-fg)/20"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="connection-status-title"
            className="fixed left-1/2 top-1/2 z-[91] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="connection-status-title" className="text-sm font-semibold uppercase tracking-wide text-(--notion-fg)/70">
                연결 상태
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-(--notion-fg)/50 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-(--notion-fg)/65">
              {visibleSourceSummary}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${youtubeStatusTone[sourceStatus.youtube]}`}>
                {youtubeStatusLabel[sourceStatus.youtube]}
              </span>
              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300">
                RSS {sourceStatus.rss === "ready" ? "정상" : "오류"}
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
