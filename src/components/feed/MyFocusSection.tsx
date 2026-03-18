"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { loadGoals, saveGoals } from "@/lib/goals";
import { rankFeedByGoalsAction } from "@/app/actions/summarize";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import type { TodayFocusEntry } from "./TodayFocusCard";

type AiRankedRecommendation = TodayFocusEntry;

export default function MyFocusSection() {
  const radio = useRadioQueueOptional();
  const [goals, setGoals] = useState("");
  const [goalsTouched, setGoalsTouched] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBriefing, setAiBriefing] = useState<AiRankedRecommendation[] | null>(null);
  const [focusExpanded, setFocusExpanded] = useState(false);

  useEffect(() => {
    const stored = loadGoals();
    setGoals(stored);
    setFocusExpanded(!stored.trim());
  }, []);

  const handlePlayFromBriefing = useCallback(
    (entry: AiRankedRecommendation) => {
      if (!radio) return;
      const item = entry.item;
      if (item.source !== "YouTube" || !item.id) return;

      const videoId = item.id;
      const title = item.title;

      const existsIndex = radio.queue.findIndex((q) => q.videoId === videoId);
      if (existsIndex >= 0) {
        radio.setCurrentIndex(existsIndex);
        radio.play();
        return;
      }

      const summary =
        typeof window !== "undefined"
          ? localStorage.getItem(`summary_${videoId}`) ?? undefined
          : undefined;

      radio.addToQueue({
        videoId,
        title,
        ...(summary ? { summary } : {}),
      });

      const newIndex = radio.queue.length;
      radio.setCurrentIndex(newIndex);
      radio.play();
    },
    [radio],
  );

  const handleRunAiBriefing = async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const result = await rankFeedByGoalsAction(goals);
      if (!result) {
        setAiError("AI 브리핑 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        setAiBriefing(null);
        return;
      }
      if ("error" in result && result.error) {
        setAiError(result.error);
        setAiBriefing(null);
        return;
      }
      if ("ranked" in result && Array.isArray(result.ranked) && result.ranked.length > 0) {
        setAiBriefing(result.ranked.slice(0, 3) as AiRankedRecommendation[]);
      } else {
        setAiError("사용자 목표/관심사와 잘 맞는 추천을 찾지 못했습니다.");
        setAiBriefing(null);
      }
    } catch (error) {
      console.error("AI Morning Briefing 호출 오류:", error);
      setAiError("AI 브리핑 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setAiBriefing(null);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <section className="mb-3 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-3 text-sm sm:px-5 sm:py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/60">
            My Focus
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-(--notion-fg)/70 sm:text-[12px]">
            {goals.trim()
              ? goals
              : "지금 가장 중요한 목표나 관심사를 한두 줄로 적어보세요."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-(--notion-fg)/65">
          <button
            type="button"
            onClick={() => setFocusExpanded((prev) => !prev)}
            className="rounded-full border border-(--notion-border) px-2.5 py-1 font-semibold hover:bg-(--notion-hover)"
          >
            {focusExpanded ? "접기" : "편집"}
          </button>
          <button
            type="button"
            onClick={handleRunAiBriefing}
            disabled={!goals.trim() || aiLoading}
            className="rounded-full bg-(--notion-fg) px-3 py-1 text-[11px] font-semibold text-(--notion-bg) transition-colors hover:bg-(--notion-fg)/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiLoading ? "브리핑 중..." : "AI 브리핑"}
          </button>
        </div>
      </div>

      {focusExpanded && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <label htmlFor="my-focus-goals" className="sr-only">
            MY FOCUS 관심사 입력
          </label>
          <textarea
            id="my-focus-goals"
            name="goals"
            value={goals}
            onChange={(e) => {
              setGoals(e.target.value);
              setGoalsTouched(true);
            }}
            placeholder="예: 3개월 안에 1인 SaaS를 런칭하고 싶어요. 프론트엔드는 할 줄 알고, 마케팅/세일즈가 약합니다."
            rows={3}
            className="min-h-[68px] flex-1 resize-none rounded-xl border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-[12px] leading-relaxed text-(--notion-fg) outline-none focus:border-(--notion-fg)/30"
          />
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                saveGoals(goals);
                setGoalsTouched(false);
              }}
              className="rounded-full bg-(--notion-fg) px-3 py-1.5 text-[11px] font-semibold text-(--notion-bg) transition-colors hover:bg-(--notion-fg)/90"
            >
              {goalsTouched ? "관심사 저장" : "저장됨"}
            </button>
          </div>
        </div>
      )}

      {((aiBriefing && aiBriefing.length > 0) || aiError) ? (
        <div className="mt-3 space-y-1.5 rounded-xl border border-(--notion-border) bg-(--notion-bg)/80 px-3 py-2.5 text-[12px]">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-(--notion-fg)/75">
              오늘의 추천 콘텐츠
            </p>
            {aiBriefing && (
              <span className="text-[10px] text-(--notion-fg)/50">
                상위 {aiBriefing.length}개 콘텐츠 기준
              </span>
            )}
          </div>

          {aiError && (
            <p className="text-[11px] leading-relaxed text-(--notion-fg)/65">
              {aiError}
            </p>
          )}

          {aiBriefing && aiBriefing.length > 0 && (
            <ul className="space-y-2.5">
              {aiBriefing.map((entry) => (
                <li
                  key={`${entry.item.source}:${entry.item.id}:${entry.priority}`}
                  className="flex gap-3 rounded-lg bg-(--notion-gray)/40 px-3 py-2"
                >
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-(--notion-gray)">
                    {entry.item.thumbnail ? (
                      <button
                        type="button"
                        onClick={() => handlePlayFromBriefing(entry)}
                        className="group relative block h-full w-full text-left"
                      >
                        <Image
                          src={entry.item.thumbnail}
                          alt={entry.item.title}
                          fill
                          sizes="120px"
                          className="object-cover transition-transform group-hover:scale-[1.03]"
                        />
                        {entry.item.source === "YouTube" && radio && (
                          <span className="absolute inset-x-1 bottom-1 rounded-full bg-black/55 px-2 py-[2px] text-[10px] font-semibold text-white">
                            라디오 재생
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-(--notion-fg)/50">
                        썸네일 없음
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-(--notion-fg)/60">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-(--notion-fg)/10 text-[10px] text-(--notion-fg)">
                          {entry.priority}
                        </span>
                        <span>우선순위</span>
                      </span>
                      <span className="text-[10px]">
                        적합도 {Math.round(entry.score)}점
                      </span>
                    </div>
                    {entry.item.source === "YouTube" &&
                    entry.item.id &&
                    radio ? (
                      <button
                        type="button"
                        onClick={() => handlePlayFromBriefing(entry)}
                        className="block text-left text-[12px] font-semibold text-(--notion-fg) underline-offset-2 hover:underline"
                      >
                        {entry.item.title}
                      </button>
                    ) : (
                      <a
                        href={entry.item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[12px] font-semibold text-(--notion-fg) underline-offset-2 hover:underline"
                      >
                        {entry.item.title}
                      </a>
                    )}
                    <p className="text-[11px] leading-relaxed text-(--notion-fg)/75">
                      {entry.why}
                    </p>
                    <p className="text-[11px] leading-relaxed text-(--notion-fg)/70">
                      <span className="font-semibold">이번 주 액션:</span>{" "}
                      {entry.action}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
