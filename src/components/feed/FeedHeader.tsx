"use client";

import React from "react";
import Image from "next/image";
import { Rss, Youtube } from "lucide-react";
import type { YouTubeFetchStatus } from "@/lib/youtube";

interface FeedHeaderProps {
  selectedSource?: { id: string; name: string; type: "YouTube" | "RSS"; avatarUrl?: string };
  visibleItemsCount: number;
  sourceStatus: { youtube: YouTubeFetchStatus; rss: "ready" | "request_failed" };
}

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
}: FeedHeaderProps) {
  const showYoutubeNotice = sourceStatus.youtube !== "ready" && (!selectedSource || selectedSource.type === "YouTube");

  return (
    <section
      data-testid={selectedSource ? "source-header" : undefined}
      className={selectedSource
        ? "mb-3 rounded-2xl border border-(--border-subtle) bg-(--surface-raised) px-4 py-4 shadow-[var(--shadow-xs)] sm:px-5"
        : "mb-3 px-1"}
    >
      {selectedSource ? (
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--surface-subtle) text-(--text-secondary)">
            {selectedSource.avatarUrl ? (
              <Image src={selectedSource.avatarUrl} alt="" fill sizes="44px" className="object-cover" />
            ) : selectedSource.type === "YouTube" ? (
              <Youtube className="h-5 w-5 text-red-500" aria-hidden />
            ) : (
              <Rss className="h-5 w-5 text-blue-500" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-(--text-secondary)">
              {selectedSource.type === "YouTube" ? "YouTube channel" : "RSS source"}
            </p>
            <h1 className="m-0! mt-1! truncate text-xl! font-bold leading-tight! tracking-[-0.025em] text-(--text-primary) sm:text-2xl!">
              {selectedSource.name}
            </h1>
            <p className="m-0 mt-1 text-xs text-(--text-secondary)">
              최신 콘텐츠 {visibleItemsCount}개를 한곳에서 확인합니다.
            </p>
          </div>
        </div>
      ) : (
        <span className="rounded-full border border-(--notion-border) bg-(--notion-bg)/80 px-3 py-1 text-[11px] text-(--notion-fg)/60">
          총 {visibleItemsCount}개
        </span>
      )}

      {showYoutubeNotice && (
        <div className="mt-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg)/70 px-4 py-3 text-sm leading-relaxed text-(--notion-fg)/65">
          {youtubeNoticeMessage[sourceStatus.youtube](selectedSource)}
        </div>
      )}
    </section>
  );
}
