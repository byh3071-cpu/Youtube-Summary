"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { loadGoals } from "@/lib/goals";
import { rankFeedByGoalsAction } from "@/app/actions/summarize";
import type { TodayFocusEntry } from "@/components/feed/TodayFocusCard";

type AiRankedRecommendation = TodayFocusEntry;

interface BookmarkLikePayload {
  video_id: string;
  video_title: string;
  highlight?: string | null;
}

export default function SmartBookmarkSuggestions() {
  const [goals, setGoals] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AiRankedRecommendation[] | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = loadGoals();
    setGoals(stored);
  }, []);

  const handleRun = async () => {
    if (!goals.trim()) {
      setError("My Focus에 목표를 먼저 적어 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await rankFeedByGoalsAction(goals);
      if (!result) {
        setError("AI 추천 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        setItems(null);
        return;
      }
      if ("error" in result && result.error) {
        setError(result.error);
        setItems(null);
        return;
      }
      if ("ranked" in result && Array.isArray(result.ranked) && result.ranked.length > 0) {
        setItems(result.ranked.slice(0, 5) as AiRankedRecommendation[]);
      } else {
        setError("최근 피드에서 추천할 만한 영상을 찾지 못했습니다.");
        setItems(null);
      }
    } catch (e) {
      console.error("SmartBookmarkSuggestions rank error", e);
      setError("AI 추천 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setItems(null);
    } finally {
      setLoading(false);
    }
  };

  const addBookmark = async (payload: BookmarkLikePayload) => {
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: payload.video_id,
          video_title: payload.video_title,
          highlight: payload.highlight ?? payload.video_title,
        }),
      });
      if (!res.ok) {
        // 에러는 조용히 로깅만
        console.error("AI 추천 북마크 추가 실패", await res.text().catch(() => "")); // best-effort
        return;
      }
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        next.add(payload.video_id);
        return next;
      });
    } catch (e) {
      console.error("AI 추천 북마크 추가 중 오류", e);
    }
  };

  if (!goals.trim()) {
    return (
      <section className="mb-4 rounded-2xl border border-dashed border-(--notion-border) bg-(--notion-bg) px-4 py-3 text-[12px] text-(--notion-fg)/70 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-(--notion-fg)/65">
          AI 추천 북마크
        </p>
        <p className="mt-1">
          먼저 피드 상단의 <strong>My Focus</strong>에 지금 가장 중요한 목표나 관심사를 적어 두면,
          그 기준으로 북마크하면 좋은 영상 TOP 추천을 보여줄게요.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-3 text-[12px] text-(--notion-fg)/80 sm:px-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-(--notion-fg)/65">
            AI 추천 북마크
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-(--notion-fg)/70">
            My Focus에 적어둔 목표를 기준으로, 지금 북마크하면 좋은 유튜브 영상을 골라드려요.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="rounded-full bg-(--focus-accent) px-3 py-1 text-[11px] font-semibold text-black shadow-sm transition-colors hover:bg-(--focus-accent)/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? \"분석 중...\" : \"AI 추천 불러오기\"}
        </button>
      </div>

      {error && (
        <p className="mt-1 text-[11px] leading-relaxed text-red-500">
          {error}
        </p>
      )}

      {items && items.length > 0 && (
        <ul className="mt-2 space-y-2.5">
          {items.map((entry) => {
            const { item, score, why } = entry;
            const isYoutube = item.source === "YouTube" && !!item.id;
            const alreadyBookmarked = isYoutube && item.id ? bookmarkedIds.has(item.id) : false;
            const videoId = isYoutube && item.id ? item.id : null;

            return (
              <li
                key={`${item.source}:${item.id}:${entry.priority}`}
                className="flex gap-3 rounded-xl border border-(--notion-border) bg-(--notion-gray)/40 px-3 py-2"
              >
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-(--notion-gray)">
                  {item.thumbnail ? (
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-(--notion-fg)/50">
                      썸네일 없음
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-(--notion-fg)/60">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-(--notion-fg)/10 text-[10px] text-(--notion-fg)">
                        {entry.priority}
                      </span>
                      <span>우선순위</span>
                    </span>
                    <span className="text-[10px]">적합도 {Math.round(score)}점</span>
                  </div>
                  <p className="text-[12px] font-semibold leading-snug text-(--notion-fg)">
                    {item.title}
                  </p>
                  <p className="text-[11px] leading-snug text-(--notion-fg)/75 line-clamp-2">
                    {why}
                  </p>
                  {isYoutube && videoId && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        disabled={alreadyBookmarked}
                        onClick={() =>
                          addBookmark({
                            video_id: videoId,
                            video_title: item.title,
                            highlight: why,
                          })
                        }
                        className="rounded-full border border-(--notion-border) bg-(--notion-bg) px-2.5 py-1 font-semibold text-(--notion-fg)/80 hover:bg-(--notion-hover) disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {alreadyBookmarked ? "북마크 완료" : "이 영상 북마크"}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

