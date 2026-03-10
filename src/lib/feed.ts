import { FeedItem } from "../types/feed";
import { fetchYouTubeFeed } from "./youtube";
import { fetchRssFeed } from "./rss";

export interface FeedSource {
    id: string; // url or channel id
    name: string;
    type: "YouTube" | "RSS";
}

// 화이트리스트 기본값
export const defaultSources: FeedSource[] = [
    // User Requested YouTube Channels
    { id: "UCSkpTOEl_zW6b4Y7M_Prefg", name: "일잘러 장피엠", type: "YouTube" },
    { id: "UC-lHJZR3Gqxm24_Vd_AJ5Yw", name: "노마드 코더 (Nomad Coders)", type: "YouTube" },
    { id: "UCt2wAAXgm87ACiQnDHQEW6Q", name: "테디노트 (TeddyNote)", type: "YouTube" },
    { id: "UCCU2H8fnVx20POKCzFm-G5Q", name: "드로우앤드류 (DrawAndrew)", type: "YouTube" },
    // AI Blogs (예시)
    { id: "https://news.hada.io/rss/news", name: "GeekNews", type: "RSS" },
    { id: "https://openai.com/blog/rss.xml", name: "OpenAI Blog", type: "RSS" } // Note: OpenAI는 RSS 엔드포인트가 자주 바뀔 수 있음
];

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
