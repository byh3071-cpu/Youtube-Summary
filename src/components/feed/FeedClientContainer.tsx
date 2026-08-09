"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FeedItem } from "@/types/feed";
import type { FeedCategory } from "@/types/feed";
import { filterFeedByKeywords, filterFeedByCategory, filterFeedByTrendKeyword, filterFeedBySearch } from "@/lib/filter";
import FeedList from "./FeedList";
import FeedReelView from "./FeedReelView";
import LongformFeedView from "./LongformFeedView";
import FeedSearch from "./FeedSearch";
import { useKeywordFilter } from "./KeywordFilter";
import ViewSwitcher, { type ViewMode } from "./ViewSwitcher";
import MyFocusSection from "./MyFocusSection";
import UsageBadge from "./UsageBadge";
import FeedQADrawer from "./FeedQADrawer";
import DiscoveryFilterPanel from "./DiscoveryFilterPanel";
import { TrendFilterProvider, useTrendFilter } from "@/contexts/TrendFilterContext";
import { FEED_CATEGORIES } from "@/lib/sources";
import { getContentStatesAction, type ContentStateInfo } from "@/app/actions/content-state";
import { isItemVisibleUnderStateFilter } from "@/types/content-state";
import { useIsHydrated } from "@/lib/use-is-hydrated";
import {
  KNOWLEDGE_STATUS_QUERY_LIMIT,
  knowledgeJobIsOpen,
  mergeKnowledgeJobMaps,
  notifyKnowledgeJobsChanged,
  type KnowledgeJobMap,
  type KnowledgeJobSummary,
} from "@/lib/knowledge-capture";

export type BookmarkEntry = {
  id: string;
  video_id: string;
  video_title: string;
  highlight: string;
  created_at: string;
};

const HOME_SCROLL_STORAGE_KEY = "focus-feed:home-scroll-y";
const KNOWLEDGE_STATUS_POLL_MS = 15_000;
const KNOWLEDGE_STATUS_MAX_POLL_MS = 120_000;

function filterByView(items: FeedItem[], view: ViewMode): FeedItem[] {
  if (view === "youtube") return items.filter((i) => i.source === "YouTube");
  if (view === "rss") return items.filter((i) => i.source === "RSS");
  return items;
}


type FeedClientContainerProps = {
    initialItems: FeedItem[];
    selectedSourceName?: string;
    /** 단일 소스 보기일 때 피드 Q&A 컨텍스트 제한용 */
    selectedSourceId?: string;
    initialCategory?: FeedCategory | null;
    initialView?: ViewMode;
    viewMode?: "longform" | "shortform" | "live" | null;
    initialWatchVideoId?: string | null;
    children?: ReactNode;
};

export default function FeedClientContainer(props: FeedClientContainerProps) {
  return (
    <TrendFilterProvider>
      <FeedClientContainerContent {...props} />
    </TrendFilterProvider>
  );
}

function FeedClientContainerContent({
    initialItems,
    selectedSourceName,
    selectedSourceId,
    initialCategory = null,
    initialView = "all",
    viewMode = null,
    initialWatchVideoId = null,
    children,
}: FeedClientContainerProps) {
    const pathname = usePathname();
    const isReelMode = viewMode === "longform" || viewMode === "shortform" || viewMode === "live";
    const [view, setView] = useState<ViewMode>(initialView);

    const { keywords, addKeyword, removeKeyword, clearKeywords } = useKeywordFilter();
    const [selectedCategory, setSelectedCategory] = useState<FeedCategory | null>(initialCategory);
    const [searchQuery, setSearchQuery] = useState("");
    const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
    const [contentStates, setContentStates] = useState<Record<string, ContentStateInfo>>({});
    const [knowledgeJobs, setKnowledgeJobs] = useState<KnowledgeJobMap>({});
    const [stateFilter, setStateFilter] = useState<"all" | "queued" | "dismissed">("all");
    const isHydrated = useIsHydrated();
    const knowledgeVideoIds = useMemo(
        () => [...new Set(initialItems.filter((item) => item.source === "YouTube" && item.id).map((item) => item.id))],
        [initialItems],
    );

    useLayoutEffect(() => {
        if (isReelMode) return;
        let firstFrame = 0;
        let secondFrame = 0;
        try {
            const stored = Number(sessionStorage.getItem(HOME_SCROLL_STORAGE_KEY));
            if (!Number.isFinite(stored) || stored <= 0) return;
            const initialScrollY = window.scrollY;
            firstFrame = requestAnimationFrame(() => {
                secondFrame = requestAnimationFrame(() => {
                    if (Math.abs(window.scrollY - initialScrollY) < 1) {
                        window.scrollTo({ top: stored, behavior: "auto" });
                    }
                });
            });
        } catch {
            return;
        }
        return () => {
            if (firstFrame) cancelAnimationFrame(firstFrame);
            if (secondFrame) cancelAnimationFrame(secondFrame);
        };
    }, [isReelMode, pathname]);

    useLayoutEffect(() => {
        if (isReelMode) return;
        const saveScroll = () => {
            try {
                sessionStorage.setItem(HOME_SCROLL_STORAGE_KEY, String(Math.max(0, Math.round(window.scrollY))));
            } catch {}
        };
        window.addEventListener("scroll", saveScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", saveScroll);
        };
    }, [isReelMode]);

    const fetchBookmarks = useCallback(async () => {
        try {
            const res = await fetch("/api/bookmarks");
            if (res.ok) {
                const data = await res.json();
                setBookmarks(Array.isArray(data) ? data : []);
            }
        } catch {
            // 북마크 로드 실패 시 조용히 무시 (비필수 기능)
        }
    }, []);

    const fetchContentStates = useCallback(async () => {
        try {
            const map = await getContentStatesAction();
            setContentStates(map);
        } catch {
            // 상태 로드 실패 시 조용히 무시 (비로그인·미설정 등)
        }
    }, []);

    const fetchKnowledgeJobs = useCallback(async (
        requestedVideoIds: string[] = knowledgeVideoIds,
    ): Promise<KnowledgeJobMap | null> => {
        if (requestedVideoIds.length === 0) return {};
        try {
            const batches: string[][] = [];
            for (let index = 0; index < requestedVideoIds.length; index += KNOWLEDGE_STATUS_QUERY_LIMIT) {
                batches.push(requestedVideoIds.slice(index, index + KNOWLEDGE_STATUS_QUERY_LIMIT));
            }
            const nextJobs: KnowledgeJobMap = {};
            // 초기 피드가 커도 인증·DB 요청을 한꺼번에 폭발시키지 않는다.
            for (const videoIds of batches) {
                const params = new URLSearchParams({ videoIds: videoIds.join(",") });
                const response = await fetch(`/api/knowledge/status?${params.toString()}`, {
                    cache: "no-store",
                });
                if (!response.ok) return null;
                const data = (await response.json()) as { jobs?: KnowledgeJobSummary[] };
                const jobs = Array.isArray(data.jobs) ? data.jobs : [];
                for (const job of jobs) nextJobs[job.videoId] = job;
            }
            return nextJobs;
        } catch {
            // 비로그인·미설정·일시적 네트워크 오류는 피드 읽기를 막지 않는다.
            return null;
        }
    }, [knowledgeVideoIds]);

    useEffect(() => {
        setSelectedCategory(initialCategory);
    }, [initialCategory]);

    useEffect(() => {
        fetchBookmarks();
    }, [fetchBookmarks]);

    useEffect(() => {
        fetchContentStates();
    }, [fetchContentStates]);

    useEffect(() => {
        let cancelled = false;
        void fetchKnowledgeJobs().then((nextJobs) => {
            if (!cancelled && nextJobs) {
                setKnowledgeJobs((previous) => mergeKnowledgeJobMaps(previous, nextJobs));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [fetchKnowledgeJobs]);

    const activeKnowledgeVideoIds = useMemo(
        () => Object.values(knowledgeJobs)
            .filter((job) => (job.captureReady && job.status === "queued") || job.status === "processing" || job.status === "approving")
            .map((job) => job.videoId)
            .sort(),
        [knowledgeJobs],
    );
    const activeKnowledgeKey = activeKnowledgeVideoIds.join(",");
    const activeKnowledgeVersion = activeKnowledgeVideoIds
        .map((videoId) => `${videoId}:${knowledgeJobs[videoId]?.updatedAt ?? ""}`)
        .join("|");

    useEffect(() => {
        if (!activeKnowledgeKey) return;
        const videoIds = activeKnowledgeKey.split(",");
        let cancelled = false;
        let timer = 0;
        let delay = KNOWLEDGE_STATUS_POLL_MS;
        let lastVersion = activeKnowledgeVersion;

        const poll = async () => {
            if (document.visibilityState === "hidden") {
                delay = Math.min(delay * 2, KNOWLEDGE_STATUS_MAX_POLL_MS);
                timer = window.setTimeout(poll, delay);
                return;
            }
            const nextJobs = await fetchKnowledgeJobs(videoIds);
            if (cancelled) return;
            if (nextJobs) {
                setKnowledgeJobs((previous) => mergeKnowledgeJobMaps(previous, nextJobs));
                if (Object.values(nextJobs).some((job) => !knowledgeJobIsOpen(job.status))) {
                    notifyKnowledgeJobsChanged();
                }
                const nextVersion = Object.values(nextJobs)
                    .map((job) => `${job.videoId}:${job.updatedAt}`)
                    .sort()
                    .join("|");
                delay = nextVersion === lastVersion
                    ? Math.min(delay * 2, KNOWLEDGE_STATUS_MAX_POLL_MS)
                    : KNOWLEDGE_STATUS_POLL_MS;
                lastVersion = nextVersion;
            } else {
                delay = Math.min(delay * 2, KNOWLEDGE_STATUS_MAX_POLL_MS);
            }
            timer = window.setTimeout(poll, delay);
        };

        timer = window.setTimeout(poll, KNOWLEDGE_STATUS_POLL_MS);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [activeKnowledgeKey, activeKnowledgeVersion, fetchKnowledgeJobs]);

    useEffect(() => {
        const refreshVisibleStatuses = () => {
            if (document.visibilityState !== "visible") return;
            void fetchKnowledgeJobs().then((nextJobs) => {
                if (nextJobs) {
                    setKnowledgeJobs((previous) => mergeKnowledgeJobMaps(previous, nextJobs));
                }
            });
        };
        window.addEventListener("focus", refreshVisibleStatuses);
        document.addEventListener("visibilitychange", refreshVisibleStatuses);
        return () => {
            window.removeEventListener("focus", refreshVisibleStatuses);
            document.removeEventListener("visibilitychange", refreshVisibleStatuses);
        };
    }, [fetchKnowledgeJobs]);

    const handleKnowledgeJobChange = useCallback((job: KnowledgeJobSummary) => {
        setKnowledgeJobs((previous) => mergeKnowledgeJobMaps(previous, { [job.videoId]: job }));
    }, []);

    const handleCategoryChange = (category: FeedCategory | null) => {
        setSelectedCategory(category);
        const params = new URLSearchParams(window.location.search);
        if (category) params.set("category", category);
        else params.delete("category");
        const q = params.toString();
        window.history.replaceState(window.history.state, "", q ? `${pathname}?${q}` : pathname);
    };

    const handleViewChange = (nextView: ViewMode) => {
        setView(nextView);

        // 보기 전환은 이미 내려받은 피드를 클라이언트에서 즉시 필터링한다.
        // 주소만 History API로 동기화해 App Router 서버 재실행과 전체 피드 재조회를 피한다.
        const params = new URLSearchParams(window.location.search);
        if (nextView === "all") params.delete("view");
        else params.set("view", nextView);
        const query = params.toString();
        window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
    };

    const trendFilter = useTrendFilter();
    const selectedTrendKeyword = trendFilter?.selectedTrendKeyword ?? null;
    const selectedTrendSamples = trendFilter?.selectedTrendSamples;

    const byView = useMemo(() => filterByView(initialItems, view), [initialItems, view]);
    const bySearch = useMemo(() => filterFeedBySearch(byView, searchQuery), [byView, searchQuery]);
    const byKeywords = useMemo(() => filterFeedByKeywords(bySearch, keywords), [bySearch, keywords]);
    const byCategory = useMemo(() => filterFeedByCategory(byKeywords, selectedCategory), [byKeywords, selectedCategory]);
    const filteredItems = useMemo(
        () => filterFeedByTrendKeyword(byCategory, selectedTrendKeyword, selectedTrendSamples ?? []),
        [byCategory, selectedTrendKeyword, selectedTrendSamples]
    );
    const hasActiveFilters = keywords.length > 0 || stateFilter !== "all";

    // 선별 반영: 제외(dismissed)는 기본으로 숨기고, 상태 필터에 따라 좁힌다.
    const stateCounts = useMemo(() => {
        let queued = 0;
        let dismissed = 0;
        for (const id in contentStates) {
            const s = contentStates[id].state;
            if (s === "queued") queued += 1;
            else if (s === "dismissed") dismissed += 1;
        }
        return { queued, dismissed };
    }, [contentStates]);

    const visibleItems = useMemo(() => {
        return filteredItems.filter((item) =>
            isItemVisibleUnderStateFilter(item, contentStates, stateFilter)
        );
    }, [filteredItems, contentStates, stateFilter]);

    const availableCategories = useMemo(
        () => FEED_CATEGORIES.filter(cat => byKeywords.some(item => item.category === cat)),
        [byKeywords]
    );

    const isGlobalFeed = !selectedSourceName;
    if (viewMode === "longform") {
        return (
            <LongformFeedView
                items={visibleItems}
                initialWatchVideoId={initialWatchVideoId}
                bookmarks={bookmarks}
                onBookmarkChange={fetchBookmarks}
                knowledgeJobs={knowledgeJobs}
                onKnowledgeJobChange={handleKnowledgeJobChange}
            />
        );
    }

    if ((viewMode === "shortform" || viewMode === "live") && viewMode) {
        return (
            <FeedReelView
                items={visibleItems}
                viewMode={viewMode}
                initialVideoId={initialWatchVideoId}
                bookmarks={bookmarks}
                onBookmarkChange={fetchBookmarks}
            />
        );
    }

    return (
        <>
            <h1 className="sr-only">
                {selectedSourceName ? `${selectedSourceName} 피드` : "Focus Feed 홈"}
            </h1>
            {/* 홈과 소스 상세이 같은 탐색 구조를 공유한다: 검색 → 트렌드 → 소스 전환(홈만). */}
            <section data-testid="discovery-toolbar" data-hydrated={isHydrated ? "true" : "false"} aria-label="피드 탐색" className="-mx-2 mb-3 bg-(--surface-raised)/95 px-2 pb-1 pt-1 backdrop-blur-xl sm:-mx-4 sm:px-4 md:sticky md:top-16 md:z-40 md:-mx-6 md:px-6 lg:top-0 lg:-mx-8 lg:px-8">
                  <div className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <FeedSearch value={searchQuery} onChange={setSearchQuery} />
                    </div>
                    <DiscoveryFilterPanel
                      keywords={keywords}
                      onAddKeyword={addKeyword}
                      onRemoveKeyword={removeKeyword}
                      onClearKeywords={clearKeywords}
                      selectedCategory={selectedCategory}
                      onCategoryChange={handleCategoryChange}
                      availableCategories={availableCategories}
                    />
                  </div>

                  {children}
                  {isGlobalFeed && (
                    <div className="flex items-center justify-between py-1">
                      <ViewSwitcher currentView={view} onChange={handleViewChange} />
                    </div>
                  )}
            </section>
            {isGlobalFeed &&
                (stateCounts.queued > 0 || stateCounts.dismissed > 0 || stateFilter !== "all") && (
                    <div className="mb-2 flex items-center gap-1.5 px-1">
                        {([
                            ["all", "전체"],
                            ["queued", `처리 대기${stateCounts.queued ? ` ${stateCounts.queued}` : ""}`],
                            ["dismissed", `제외함${stateCounts.dismissed ? ` ${stateCounts.dismissed}` : ""}`],
                        ] as const).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setStateFilter(key)}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                    stateFilter === key
                                        ? "border-(--notion-fg) bg-(--notion-fg) text-(--notion-bg)"
                                        : "border-(--notion-border) text-(--notion-fg)/65 hover:bg-(--notion-hover)"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            <FeedList
                items={visibleItems}
                hasActiveFilters={hasActiveFilters}
                selectedSourceName={selectedSourceName}
                viewMode={view}
                bookmarks={bookmarks}
                onBookmarkChange={fetchBookmarks}
                contentStates={contentStates}
                onContentStateChange={fetchContentStates}
                knowledgeJobs={knowledgeJobs}
                onKnowledgeJobChange={handleKnowledgeJobChange}
                totalCount={selectedSourceName ? filteredItems.length : undefined}
            />

            {/* 하단으로 이동: MY FOCUS · 사용량(상단에서 내림, 기능 유지) */}
            {isGlobalFeed && <MyFocusSection />}
            {isGlobalFeed && <UsageBadge />}

            <FeedQADrawer selectedSourceId={selectedSourceId} />
        </>
    );
}
