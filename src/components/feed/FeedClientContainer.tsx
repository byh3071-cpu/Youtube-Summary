"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FeedItem } from "@/types/feed";
import type { FeedCategory } from "@/types/feed";
import { filterFeedByKeywords, filterFeedByCategory } from "@/lib/filter";
import FeedList from "./FeedList";
import KeywordFilter, { useKeywordFilter } from "./KeywordFilter";
import ViewSwitcher, { type ViewMode } from "./ViewSwitcher";

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

    useEffect(() => {
        setSelectedCategory(initialCategory);
    }, [initialCategory]);

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

    return (
        <>
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
