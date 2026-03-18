"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FeedItem } from "@/types/feed";
import type { FeedCategory } from "@/types/feed";
import { filterFeedByKeywords, filterFeedByCategory, filterFeedByTrendKeyword } from "@/lib/filter";
import FeedList from "./FeedList";
import FeedReelView from "./FeedReelView";
import KeywordFilter, { useKeywordFilter } from "./KeywordFilter";
import ViewSwitcher, { type ViewMode } from "./ViewSwitcher";
import MyFocusSection from "./MyFocusSection";
import { TrendFilterProvider, useTrendFilter } from "@/contexts/TrendFilterContext";
import { FEED_CATEGORIES } from "@/lib/sources";

export type BookmarkEntry = {
  id: string;
  video_id: string;
  video_title: string;
  highlight: string;
  created_at: string;
};

function filterByView(items: FeedItem[], view: ViewMode): FeedItem[] {
  if (view === "youtube") return items.filter((i) => i.source === "YouTube");
  if (view === "rss") return items.filter((i) => i.source === "RSS");
  return items;
}


type FeedClientContainerProps = {
    initialItems: FeedItem[];
    selectedSourceName?: string;
    initialCategory?: FeedCategory | null;
    initialView?: ViewMode;
    showViewSwitcher?: boolean;
    filterLabelTranslateYCompact?: number;
    filterLabelTranslateYSource?: number;
    tooltipMarginTop?: number;
    openButtonMarginTop?: number;
    viewMode?: "longform" | "shortform" | "live" | null;
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
    initialCategory = null,
    initialView = "all",
    showViewSwitcher = false,
    viewMode = null,
    filterLabelTranslateYCompact,
    filterLabelTranslateYSource,
    tooltipMarginTop,
    openButtonMarginTop,
    children,
}: FeedClientContainerProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const viewParam = searchParams?.get("view");
    const view: ViewMode = viewParam === "youtube" || viewParam === "rss" ? viewParam : initialView;

    const { keywords, addKeyword, removeKeyword, clearKeywords } = useKeywordFilter();
    const [selectedCategory, setSelectedCategory] = useState<FeedCategory | null>(initialCategory);
    const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);

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

    useEffect(() => {
        setSelectedCategory(initialCategory);
    }, [initialCategory]);

    useEffect(() => {
        fetchBookmarks();
    }, [fetchBookmarks]);

    const handleCategoryChange = (category: FeedCategory | null) => {
        setSelectedCategory(category);
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        if (category) params.set("category", category);
        else params.delete("category");
        const q = params.toString();
        router.push(q ? `${pathname}?${q}` : pathname);
    };

    const trendFilter = useTrendFilter();
    const selectedTrendKeyword = trendFilter?.selectedTrendKeyword ?? null;

    const byView = filterByView(initialItems, view);
    const byKeywords = filterFeedByKeywords(byView, keywords);
    const byCategory = filterFeedByCategory(byKeywords, selectedCategory);
    const filteredItems = filterFeedByTrendKeyword(byCategory, selectedTrendKeyword);
    const hasActiveFilters = keywords.length > 0;

    const availableCategories = FEED_CATEGORIES.filter(cat =>
        byKeywords.some(item => item.category === cat)
    );

    const isGlobalFeed = !selectedSourceName;
    const isReelMode = viewMode === "longform" || viewMode === "shortform" || viewMode === "live";

    if (isReelMode && viewMode) {
        return (
            <FeedReelView
                items={filteredItems}
                viewMode={viewMode}
                bookmarks={bookmarks}
                onBookmarkChange={fetchBookmarks}
            />
        );
    }

    return (
        <>
            {isGlobalFeed && <MyFocusSection />}

            <KeywordFilter
                selectedSourceName={selectedSourceName}
                keywords={keywords}
                onAddKeyword={addKeyword}
                onRemoveKeyword={removeKeyword}
                onClearKeywords={clearKeywords}
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                availableCategories={availableCategories}
                compact={showViewSwitcher}
                headerRight={
                    showViewSwitcher ? <ViewSwitcher currentView={view} /> : undefined
                }
                filterLabelTranslateYCompact={filterLabelTranslateYCompact}
                filterLabelTranslateYSource={filterLabelTranslateYSource}
                tooltipMarginTop={tooltipMarginTop}
                openButtonMarginTop={openButtonMarginTop}
            />
            {children}
            <FeedList
                items={filteredItems}
                hasActiveFilters={hasActiveFilters}
                selectedSourceName={selectedSourceName}
                viewMode={view}
                bookmarks={bookmarks}
                onBookmarkChange={fetchBookmarks}
                totalCount={selectedSourceName ? filteredItems.length : undefined}
            />
        </>
    );
}
