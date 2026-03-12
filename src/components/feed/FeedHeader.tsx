import React from "react";
import Image from "next/image";
import RefreshButton from "@/components/ui/RefreshButton";
import ConnectionStatusPopup from "@/components/feed/ConnectionStatusPopup";
import { YOUTUBE_STATUS_TONE } from "@/lib/youtube-status";
import type { YouTubeFetchStatus } from "@/lib/youtube";

interface FeedHeaderProps {
  selectedSource?: { id: string; name: string; type: "YouTube" | "RSS" };
  visibleItemsCount: number;
  sourceStatus: { youtube: YouTubeFetchStatus; rss: "ready" | "request_failed" };
  youtubeSourceCount: number;
  rssSourceCount: number;
}

/** FeedHeader 전용 라벨: Sidebar보다 더 구체적인 표현 사용 */
const HEADER_STATUS_LABEL: Record<YouTubeFetchStatus, string> = {
  ready: "YouTube 연결됨",
  missing_api_key: "YouTube 키 필요",
  invalid_api_key: "YouTube 키 오류",
  request_failed: "YouTube 일시 장애",
};

const youtubeNoticeMessage: Record<YouTubeFetchStatus, (selected: FeedHeaderProps["selectedSource"]) => string> = {
  missing_api_key: (selected) => selected
    ? `현재 ${selected.name} 채널을 불러오려면 YouTube 연동이 필요합니다.`
    : "YouTube 연동이 설정되지 않아 RSS 소스만 표시하고 있습니다.",
  invalid_api_key: (selected) => selected
    ? `현재 ${selected.name} 채널을 불러올 수 없습니다. 연동 설정을 확인해 주세요.`
    : "YouTube 연동에 문제가 있어 RSS 소스만 표시하고 있습니다. 잠시 후 다시 시도해 주세요.",
  request_failed: (selected) => selected
    ? `현재 ${selected.name} 채널을 불러오지 못하고 있습니다. 잠시 후 다시 시도해 주세요.`
    : "YouTube 소스를 잠시 불러오지 못해 RSS만 표시하고 있습니다. 잠시 후 다시 시도해 주세요.",
  ready: () => "",
};

export default function FeedHeader({
  selectedSource,
  visibleItemsCount,
  sourceStatus,
  youtubeSourceCount,
  rssSourceCount,
}: FeedHeaderProps) {
  void youtubeSourceCount;
  void rssSourceCount;
  const showYoutubeNotice = sourceStatus.youtube !== "ready" && (!selectedSource || selectedSource.type === "YouTube");

  return (
    <section className="mb-4 rounded-3xl border border-(--notion-border) bg-linear-to-b from-(--notion-bg) to-(--notion-gray) p-5 sm:mb-5 sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${selectedSource ? "border-(--notion-border) bg-(--notion-bg) text-(--notion-fg)/70" : "border-(--notion-border) bg-(--notion-bg) text-(--notion-fg)/55"}`}>
            {selectedSource ? "소스 보기" : "전체 피드"}
          </span>
          {selectedSource ? (
            <h1 className="mb-3 mt-3 text-3xl font-extrabold tracking-tight sm:text-[2.35rem]">
              <span className="truncate">{selectedSource.name}</span>
            </h1>
          ) : (
            <div className="mb-3 mt-3 -ml-4">
              <div className="relative h-9 w-[180px] sm:h-11 sm:w-[220px]">
                <Image
                  src="/focus-feed-wordmark-v5.png"
                  alt="Focus Feed 로고"
                  fill
                  sizes="220px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          )}
          {selectedSource && (
            <p className="max-w-2xl text-[13px] leading-relaxed text-(--notion-fg)/65 sm:text-[14px]">
              {selectedSource.type === "YouTube"
                ? "이 채널에서 올라온 최신 항목만 모아 보고 있어요."
                : "이 소스에서 올라온 최신 항목만 모아 보고 있어요."}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-(--notion-fg)/60">
            <span className="rounded-2xl border border-(--notion-border) bg-(--notion-bg)/80 px-3 py-1.5">
              총 {visibleItemsCount}개
            </span>
            <span className={`rounded-2xl border px-3 py-1.5 ${YOUTUBE_STATUS_TONE[sourceStatus.youtube]}`}>
              {HEADER_STATUS_LABEL[sourceStatus.youtube]}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <ConnectionStatusPopup selectedSource={selectedSource} sourceStatus={sourceStatus} />
          <RefreshButton />
        </div>
      </div>

      {showYoutubeNotice && (
        <div className="mt-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg)/70 px-4 py-3 text-sm leading-relaxed text-(--notion-fg)/65">
          {youtubeNoticeMessage[sourceStatus.youtube](selectedSource)}
        </div>
      )}
    </section>
  );
}
