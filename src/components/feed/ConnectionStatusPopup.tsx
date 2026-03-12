"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, X } from "lucide-react";
import { ModalTransition } from "@/components/ui/ModalTransition";
import type { LucideIcon } from "lucide-react";
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

const youtubeStatusIcon: Record<YouTubeFetchStatus, LucideIcon> = {
  ready: CheckCircle2,
  missing_api_key: AlertTriangle,
  invalid_api_key: AlertCircle,
  request_failed: AlertCircle,
};

const youtubeStatusIconColor: Record<YouTubeFetchStatus, string> = {
  ready: "text-emerald-600 dark:text-emerald-400",
  missing_api_key: "text-amber-600 dark:text-amber-400",
  invalid_api_key: "text-rose-600 dark:text-rose-400",
  request_failed: "text-orange-600 dark:text-orange-400",
};

export default function ConnectionStatusPopup({
  selectedSource,
  sourceStatus,
}: ConnectionStatusPopupProps) {
  // 연결 상태 표시 UI는 숨기고, 추후 다시 사용할 수 있도록 컴포넌트는 유지합니다.
  return null;

  const [open, setOpen] = useState(false);

  const visibleSourceSummary = selectedSource
    ? `${selectedSource.name} 소스만 따로 보고 있습니다.`
    : sourceStatus.youtube !== "ready"
      ? "현재 RSS 소스만 피드에 반영되고 있습니다."
      : "현재 YouTube와 RSS 소스가 모두 피드에 반영되고 있습니다.";

  const StatusIcon = youtubeStatusIcon[sourceStatus.youtube];
  const iconColor = youtubeStatusIconColor[sourceStatus.youtube];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 rounded-full border border-(--notion-border) bg-(--notion-bg)/80 px-3 py-2 text-xs transition-colors hover:bg-(--notion-hover) ${iconColor}`}
        aria-label={`연결 상태: ${youtubeStatusLabel[sourceStatus.youtube]}`}
        title={`연결 상태: ${youtubeStatusLabel[sourceStatus.youtube]}`}
      >
        <StatusIcon size={16} aria-hidden />
        <span className="hidden font-medium sm:inline">연결 상태</span>
      </button>

      <ModalTransition
        open={open}
        onClose={() => setOpen(false)}
        overlayClassName="fixed inset-0 z-[90] bg-(--notion-fg)/20"
        overlayZ={90}
        panelZ={91}
        panelClassName="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-5 shadow-xl"
      >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="connection-status-title"
            className="outline-none"
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
      </ModalTransition>
    </>
  );
}
