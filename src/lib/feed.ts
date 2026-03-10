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
    { id: "UC2bcmOQv4Sxa4jI415oFhRQ", name: "일잘러 장피엠", type: "YouTube" }, // Note: 실제 ID로 필요시 교체
    { id: "UCUpJs89fSBXNolQGOYKn0YQ", name: "노마드 코더 (Nomad Coders)", type: "YouTube" },
    { id: "UCx5XG1OV2P6uZZ5FSM9Ttw", name: "테디노트 (TeddyNote)", type: "YouTube" }, // Example ID
    { id: "UCx5XG1OV2P6uZZ5FSM9Ttw", name: "드로우앤드류 (DrawAndrew)", type: "YouTube" }, // Example ID
    // AI Blogs (예시)
    { id: "https://news.hada.io/rss", name: "GeekNews", type: "RSS" },
    { id: "https://openai.com/blog/rss.xml", name: "OpenAI Blog", type: "RSS" } // Note: OpenAI는 RSS 엔드포인트가 자주 바뀔 수 있음
];

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

        let allItems: FeedItem[] = [];

        results.forEach(result => {
            if (result.status === "fulfilled") {
                allItems = [...allItems, ...result.value];
            } else {
                console.error("Failed to fetch one of the sources:", result.reason);
            }
        });

        // 시간순 (최신순) 정렬
        allItems.sort((a, b) => {
            const dateA = new Date(a.pubDate).getTime();
            const dateB = new Date(b.pubDate).getTime();
            return dateB - dateA;
        });

        return allItems;
    } catch (error) {
        console.error("Error merging feeds:", error);
        return [];
    }
}
