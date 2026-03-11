"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, RotateCcw, MoreHorizontal } from "lucide-react";
import { FeedItem as FeedItemType } from "@/types/feed";
import AddToRadioButton from "./AddToRadioButton";
import SummarizeButton from "./SummarizeButton";
import InsightButton from "./InsightButton";
import { getWatchProgress } from "@/lib/watch-history";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";

function formatTimeAgo(pubDate: string): string {
  const date = new Date(pubDate);
  if (!Number.isFinite(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  if (diff < min) return "방금 전";
  if (diff < hour) return `${Math.floor(diff / min)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < week) return `${Math.floor(diff / day)}일 전`;
  if (diff < month) return `${Math.floor(diff / week)}주 전`;
  return `${Math.floor(diff / month)}개월 전`;
}

interface Props {
  item: FeedItemType;
}

function formatSeconds(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function YouTubeCard({ item }: Props) {
  const timeAgo = formatTimeAgo(item.pubDate);
  const radio = useRadioQueueOptional();
  const [menuOpen, setMenuOpen] = useState(false);

  const storedProgress =
    typeof window !== "undefined" && item.id ? getWatchProgress(item.id) : null;
  const playback = radio?.playback;

  let baseDuration: number | null = null;
  if (playback && playback.videoId === item.id && playback.durationSeconds > 0) {
    baseDuration = playback.durationSeconds;
  } else if (storedProgress?.durationSeconds && storedProgress.durationSeconds > 0) {
    baseDuration = storedProgress.durationSeconds;
  } else if (typeof item.durationSeconds === "number" && item.durationSeconds > 0) {
    baseDuration = item.durationSeconds;
  }

  let progressSeconds: number | null = null;
  if (playback && playback.videoId === item.id && playback.positionSeconds > 0) {
    progressSeconds = playback.positionSeconds;
  } else if (storedProgress?.lastPositionSeconds && storedProgress.lastPositionSeconds > 0) {
    progressSeconds = storedProgress.lastPositionSeconds;
  }

  const completed =
    storedProgress?.completed === true ||
    (playback?.videoId === item.id && playback?.completed === true);

  const progressRatio = useMemo(() => {
    if (!progressSeconds || !baseDuration || baseDuration <= 0) return 0;
    return Math.min(1, Math.max(0, progressSeconds / baseDuration));
  }, [progressSeconds, baseDuration]);

  const resumeHref = useMemo(() => {
    if (!item.link) return "#";
    if (!progressSeconds || completed) return item.link;
    const base = item.link;
    const sep = base.includes("?") ? "&" : "?";
    const t = Math.max(0, Math.floor(progressSeconds));
    return `${base}${sep}t=${t}s`;
  }, [item.link, progressSeconds, completed]);

  const durationLabel = useMemo(() => {
    if (!baseDuration || baseDuration <= 0) return null;
    return formatSeconds(baseDuration);
  }, [baseDuration]);

  const formLabel = useMemo(() => {
    if (!baseDuration || baseDuration <= 0) return null;
    const total = baseDuration;
    const isShort = total <= 90; // 1분 30초 이하면 숏폼 느낌으로 표시
    return isShort ? "숏폼" : "롱폼";
  }, [baseDuration]);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-transparent px-3">
      <a
        href={resumeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col"
        aria-label={`${item.sourceName} - ${item.title}`}
      >
        <div className="relative w-full shrink-0 overflow-hidden bg-(--notion-gray)" style={{ aspectRatio: "16 / 9" }}>
          {item.thumbnail ? (
            <Image
              src={item.thumbnail}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-(--notion-fg)/30">
              <span className="text-sm">No thumbnail</span>
            </div>
          )}

          {(completed || (progressRatio > 0 && progressSeconds != null)) && (
            <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-[1px]">
              {completed ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  <span>시청 완료</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-3 w-3" />
                  <span>이어보기</span>
                </>
              )}
            </span>
          )}

          {durationLabel && (
            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {durationLabel}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col px-0 pb-1.5 pt-0 -mt-1">
          <div className="min-h-10">
            <h3 className="line-clamp-2 text-[11px] font-medium leading-snug tracking-tight text-(--notion-fg) group-hover:text-(--notion-fg)/90">
              {item.title}
            </h3>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {item.sourceAvatarUrl ? (
                <div className="relative h-7 w-7 overflow-hidden rounded-full bg-(--notion-gray)">
                  <Image
                    src={item.sourceAvatarUrl}
                    alt={item.sourceName}
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-(--notion-gray)">
                  <span className="text-[10px] font-semibold text-(--notion-fg)/80">
                    {item.sourceName.charAt(0)}
                  </span>
                </div>
              )}
              <p className="line-clamp-1 text-[11px] font-medium text-(--notion-fg)/75">
                {item.sourceName}
              </p>
            </div>
            <div className="shrink-0">
              {item.id && <AddToRadioButton videoId={item.id} title={item.title} />}
            </div>
          </div>

          <p className="mt-0.5 text-[10px] text-(--notion-fg)/55">
            {formLabel ? `${formLabel} · ${timeAgo}` : timeAgo}
          </p>
        </div>
      </a>
      {item.id && (
        <div
          className="px-0 pb-1.5 pt-0.5"
          onClick={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
              aria-label="AI 도구 열기"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          {menuOpen && (
            <div className="mt-1 rounded-xl border border-(--notion-border) bg-(--notion-bg) px-2.5 py-2 text-[11px] text-(--notion-fg) shadow-sm">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-(--notion-fg)/55">
                AI 도구
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <SummarizeButton videoId={item.id} />
                <InsightButton videoId={item.id} completed={completed} />
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
