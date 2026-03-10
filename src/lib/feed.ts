import { FeedItem } from "../types/feed";
import { defaultSources, FeedSource } from "./sources";
import { fetchYouTubeFeed, getYouTubeConfigurationStatus, YouTubeFetchStatus } from "./youtube";
import { fetchRssFeed } from "./rss";

export interface MergedFeedResult {
    items: FeedItem[];
    sourceStatus: {
        youtube: YouTubeFetchStatus;
        rss: "ready";
    };
}

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

export async function getMergedFeed(sources: FeedSource[] = defaultSources): Promise<MergedFeedResult> {
    const youtubeSources = sources.filter((source) => source.type === "YouTube");
    const rssSources = sources.filter((source) => source.type === "RSS");

    const youtubePromises = youtubeSources.map((source) => fetchYouTubeFeed(source.id, source.name));
    const rssPromises = rssSources.map((source) => fetchRssFeed(source.id, source.name));

    try {
        const [youtubeResults, rssResults] = await Promise.all([
            Promise.allSettled(youtubePromises),
            Promise.allSettled(rssPromises),
        ]);

        const youtubeItems: FeedItem[] = youtubeResults.flatMap((result) => {
            if (result.status === "fulfilled") {
                return result.value.items;
            }

            console.error("Failed to fetch one of the YouTube sources:", result.reason);
            return [];
        });

        const rssItems: FeedItem[] = rssResults.flatMap((result) => {
            if (result.status === "fulfilled") {
                return result.value;
            }

            console.error("Failed to fetch one of the RSS sources:", result.reason);
            return [];
        });

        const uniqueItems = dedupeItems([...youtubeItems, ...rssItems]);

        const youtubeStatus = youtubeResults.reduce<YouTubeFetchStatus>(
            (currentStatus, result) => {
                if (currentStatus === "invalid_api_key") {
                    return currentStatus;
                }

                if (result.status === "rejected") {
                    return currentStatus === "missing_api_key" ? currentStatus : "request_failed";
                }

                const nextStatus = result.value.status;

                if (nextStatus === "invalid_api_key") {
                    return nextStatus;
                }

                if (nextStatus === "missing_api_key") {
                    return currentStatus === "request_failed" ? currentStatus : nextStatus;
                }

                if (nextStatus === "request_failed") {
                    return currentStatus === "missing_api_key" ? currentStatus : nextStatus;
                }

                return currentStatus;
            },
            getYouTubeConfigurationStatus()
        );

        // 시간순 (최신순) 정렬
        uniqueItems.sort((a, b) => {
            return getSortTimestamp(b.pubDate) - getSortTimestamp(a.pubDate);
        });

        return {
            items: uniqueItems,
            sourceStatus: {
                youtube: youtubeStatus,
                rss: "ready",
            },
        };
    } catch (error) {
        console.error("Error merging feeds:", error);
        return {
            items: [],
            sourceStatus: {
                youtube: getYouTubeConfigurationStatus(),
                rss: "ready",
            },
        };
    }
}
