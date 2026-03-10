import { FeedItem } from "../types/feed";
import { defaultSources, FeedSource } from "./sources";
import { fetchYouTubeFeed } from "./youtube";
import { fetchRssFeed } from "./rss";

function getSortTimestamp(pubDate: string): number {
    const timestamp = new Date(pubDate).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function dedupeItems(items: FeedItem[]): FeedItem[] {
    const seen = new Set<string>();

    return items.filter((item) => {
        const key = `${item.source}:${item.id || item.link}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

export async function getMergedFeed(sources: FeedSource[] = defaultSources): Promise<FeedItem[]> {
    const feedPromises = sources.map(source => {
        if (source.type === "YouTube") {
            return fetchYouTubeFeed(source.id, source.name);
        } else {
            return fetchRssFeed(source.id, source.name);
        }
    });

    try {
        const results = await Promise.allSettled(feedPromises);

        const allItems: FeedItem[] = results.flatMap(result => {
            if (result.status === "fulfilled") {
                return result.value;
            } else {
                console.error("Failed to fetch one of the sources:", result.reason);
                return [];
            }
        });

        const uniqueItems = dedupeItems(allItems);

        // 시간순 (최신순) 정렬
        uniqueItems.sort((a, b) => {
            return getSortTimestamp(b.pubDate) - getSortTimestamp(a.pubDate);
        });

        return uniqueItems;
    } catch (error) {
        console.error("Error merging feeds:", error);
        return [];
    }
}
