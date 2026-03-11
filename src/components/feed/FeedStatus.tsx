import React from "react";
import { YouTubeFetchStatus } from "@/lib/youtube";

interface FeedStatusProps {
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

export default function FeedStatus({ selectedSource, sourceStatus }: FeedStatusProps) {
  const showYoutubeNotice = sourceStatus.youtube !== "ready" && (!selectedSource || selectedSource.type === "YouTube");
  
  const visibleSourceSummary = selectedSource
    ? `${selectedSource.name} 소스만 따로 보고 있습니다.`
    : showYoutubeNotice
      ? "현재 RSS 소스만 피드에 반영되고 있습니다."
      : "현재 YouTube와 RSS 소스가 모두 피드에 반영되고 있습니다.";

  return (
    <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="mb-1 text-sm font-semibold">현재 표시 중인 소스</p>
        <p className="text-sm leading-relaxed text-(--notion-fg)/55">
          {visibleSourceSummary}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full border px-3 py-1.5 ${youtubeStatusTone[sourceStatus.youtube]}`}>
          {youtubeStatusLabel[sourceStatus.youtube]}
        </span>
        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-blue-700 dark:text-blue-300">
          RSS 정상
        </span>
      </div>
    </section>
  );
}
