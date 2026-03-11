"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FeedItem } from "@/types/feed";
import type { FeedCategory } from "@/types/feed";
import { filterFeedByKeywords, filterFeedByCategory } from "@/lib/filter";
import FeedList from "./FeedList";
import KeywordFilter, { useKeywordFilter } from "./KeywordFilter";
import ViewSwitcher, { type ViewMode } from "./ViewSwitcher";
import { loadGoals, saveGoals } from "@/lib/goals";
import { rankFeedByGoalsAction } from "@/app/actions/summarize";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import TodayFocusCard, { type TodayFocusEntry } from "./TodayFocusCard";

function filterByView(items: FeedItem[], view: ViewMode): FeedItem[] {
  if (view === "youtube") return items.filter((i) => i.source === "YouTube");
  if (view === "rss") return items.filter((i) => i.source === "RSS");
  return items;
}

function computeRecommendations(items: FeedItem[], goals: string, max = 3): FeedItem[] {
  const trimmed = goals.trim();
  if (!trimmed) return [];

  const loweredGoals = trimmed.toLowerCase();
  const rawKeywords = loweredGoals
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const keywords = rawKeywords.length > 0 ? rawKeywords : loweredGoals.split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];

  const scored = items.map((item) => {
    const text = `${item.title} ${item.summary || ""} ${item.sourceName}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (kw && text.includes(kw)) score += 2;
    }
    if (item.category === "AI") score += 1;
    return { item, score };
  });

  const filtered = scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ item }) => item);

  return filtered;
}

interface AiRankedRecommendation extends TodayFocusEntry {}

export default function FeedClientContainer({
    initialItems,
    selectedSourceName,
    initialCategory = null,
    initialView = "all",
    showViewSwitcher = false,
}: {
    initialItems: FeedItem[];
    selectedSourceName?: string;
    initialCategory?: FeedCategory | null;
    initialView?: ViewMode;
    showViewSwitcher?: boolean;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const viewParam = searchParams?.get("view");
    const view: ViewMode = viewParam === "youtube" || viewParam === "rss" ? viewParam : initialView;

    const { keywords, addKeyword, removeKeyword, clearKeywords } = useKeywordFilter();
    const [selectedCategory, setSelectedCategory] = useState<FeedCategory | null>(initialCategory);
    const [goals, setGoals] = useState("");
    const [goalsTouched, setGoalsTouched] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiBriefing, setAiBriefing] = useState<AiRankedRecommendation[] | null>(null);
    const [focusExpanded, setFocusExpanded] = useState(false);
    const radio = useRadioQueueOptional();

    useEffect(() => {
        setSelectedCategory(initialCategory);
    }, [initialCategory]);

    useEffect(() => {
        // 클라이언트에서만 goals 초기화
        const stored = loadGoals();
        setGoals(stored);
        // 저장된 목표가 없으면 처음에는 My Focus를 펼쳐서 보여줌
        setFocusExpanded(!stored.trim());
    }, []);

    const handleCategoryChange = (category: FeedCategory | null) => {
        setSelectedCategory(category);
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        if (category) params.set("category", category);
        else params.delete("category");
        const q = params.toString();
        router.push(q ? `${pathname}?${q}` : pathname);
    };

    const byView = filterByView(initialItems, view);
    const byKeywords = filterFeedByKeywords(byView, keywords);
    const filteredItems = filterFeedByCategory(byKeywords, selectedCategory);
    const hasActiveFilters = keywords.length > 0;
    const hasCategoryFilter = selectedCategory !== null;

    const recommendations = useMemo(
        () => computeRecommendations(byView, goals),
        [byView, goals]
    );

    const handlePlayFromBriefing = (entry: AiRankedRecommendation) => {
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
    };

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
                // 상위 3개만 보여주기
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

    const topEntry = aiBriefing && aiBriefing.length > 0 ? aiBriefing[0] : null;
    const isGlobalFeed = !selectedSourceName;

    return (
        <>
            {isGlobalFeed && topEntry && <TodayFocusCard entry={topEntry} />}

            {isGlobalFeed && (
            <section className="mb-3 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-3 text-sm sm:px-5 sm:py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/60">
                            My Focus
                        </p>
                        <p className="mt-1 line-clamp-1 text-[11px] text-(--notion-fg)/65">
                            {goals.trim()
                                ? goals
                                : "지금 가장 중요한 목표나 관심사를 한두 줄로 적어보세요."}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-(--notion-fg)/65">
                        <button
                            type="button"
                            onClick={() => setFocusExpanded(prev => !prev)}
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
                        <textarea
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

                {focusExpanded && ((aiBriefing && aiBriefing.length > 0) || aiError) ? (
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
                                            {entry.item.source === "YouTube" && entry.item.id && radio ? (
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
                                                <span className="font-semibold">이번 주 액션:</span> {entry.action}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : null}
            </section>
            )}

            <KeywordFilter
                selectedSourceName={selectedSourceName}
                filteredItemsCount={filteredItems.length}
                keywords={keywords}
                onAddKeyword={addKeyword}
                onRemoveKeyword={removeKeyword}
                onClearKeywords={clearKeywords}
                hasCategoryFilter={hasCategoryFilter}
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                compact={showViewSwitcher}
                headerRight={
                    showViewSwitcher ? <ViewSwitcher currentView={view} /> : undefined
                }
            />
            <FeedList
                items={filteredItems}
                hasActiveFilters={hasActiveFilters}
                selectedSourceName={selectedSourceName}
                viewMode={view}
            />
        </>
    );
}
