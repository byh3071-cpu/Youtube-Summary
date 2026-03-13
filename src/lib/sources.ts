import type { FeedCategory } from "@/types/feed";

export interface FeedSource {
    id: string;
    name: string;
    type: "YouTube" | "RSS";
    category: FeedCategory;
    /** YouTube 채널 프로필 이미지 (있을 때만 사용) */
    avatarUrl?: string;
}

export const defaultSources: FeedSource[] = [
    { id: "UCSkpTOEl_zW6b4Y7M_Prefg", name: "일잘러 장피엠", type: "YouTube", category: "자기계발" },
    { id: "UCUpJs89fSBXNolQGOYKn0YQ", name: "노마드 코더 (Nomad Coders)", type: "YouTube", category: "개발" },
    { id: "UCt2wAAXgm87ACiQnDHQEW6Q", name: "테디노트 (TeddyNote)", type: "YouTube", category: "개발" },
    { id: "UCCU2H8fnVx20POKCzFm-G5Q", name: "드로우앤드류 (DrawAndrew)", type: "YouTube", category: "자기계발" },
    { id: "UCQ2DWm5Md16Dc3xRwwhVE7Q", name: "EO Korea", type: "YouTube", category: "스타트업·비즈니스" },
    { id: "https://news.hada.io/rss/news", name: "GeekNews", type: "RSS", category: "뉴스" },
    { id: "https://openai.com/blog/rss.xml", name: "OpenAI Blog", type: "RSS", category: "AI" },
    { id: "http://feeds.feedburner.com/blogspot/gJZg", name: "Google AI Blog", type: "RSS", category: "AI" },
    { id: "https://www.microsoft.com/en-us/ai/blog/feed/", name: "Microsoft AI Blog", type: "RSS", category: "AI" },
    { id: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml", name: "Anthropic News", type: "RSS", category: "AI" },
];

export function getSourceById(sourceId?: string): FeedSource | undefined {
    if (!sourceId) {
        return undefined;
    }

    return defaultSources.find((source) => source.id === sourceId);
}

/** 카테고리 목록 (필터/사이드바용) */
export const FEED_CATEGORIES: FeedCategory[] = ["AI", "자기계발", "개발", "뉴스", "스타트업·비즈니스", "기타"];
