"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FeedItem } from "@/types/feed";
import type { FeedCategory } from "@/types/feed";
import { filterFeedByKeywords, filterFeedByCategory } from "@/lib/filter";
import FeedList from "./FeedList";
import KeywordFilter, { useKeywordFilter } from "./KeywordFilter";
import ViewSwitcher, { type ViewMode } from "./ViewSwitcher";
import MyFocusSection from "./MyFocusSection";

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
    const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);

    const fetchBookmarks = useCallback(async () => {
        const res = await fetch("/api/bookmarks");
        if (res.ok) {
            const data = await res.json();
            setBookmarks(Array.isArray(data) ? data : []);
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

    const byView = filterByView(initialItems, view);
    const byKeywords = filterFeedByKeywords(byView, keywords);
    const filteredItems = filterFeedByCategory(byKeywords, selectedCategory);
    const hasActiveFilters = keywords.length > 0;

    const isGlobalFeed = !selectedSourceName;

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
                bookmarks={bookmarks}
                onBookmarkChange={fetchBookmarks}
            />
        </>
    );
}
