import Parser from 'rss-parser';
import { FeedItem } from '../types/feed';

type CustomFeed = { title: string };
type CustomItem = { title: string; link: string; pubDate: string; contentSnippet?: string };

const parser = new Parser<CustomFeed, CustomItem>();

export async function fetchRssFeed(url: string, sourceName: string): Promise<FeedItem[]> {
    try {
        // Next.js 캐싱을 위한 fetch API 우회 사용
        // rss-parser는 기본적으로 내부에서 http 모듈을 사용하므로 Next.js의 fetch 캐싱이 
        // 기본적으로 적용되지 않을 수 있습니다. 
        // 이를 해결하기 위해 fetch로 먼저 가져온 뒤 파싱합니다.
        const response = await fetch(url, {
            next: { revalidate: 7200 } // 2시간 캐시
        });

        if (!response.ok) {
            console.error(`Error fetching RSS feed from ${url}: ${response.statusText}`);
            return [];
        }

        const xml = await response.text();
        const feed = await parser.parseString(xml);

        // 최근 10개 글만 가져오기
        const items = feed.items.slice(0, 10);

        return items.map((item) => {
            return {
                id: item.link || item.title || Math.random().toString(36).substring(7),
                title: item.title || "No title",
                link: item.link || url,
                pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                source: "RSS",
                sourceName: sourceName,
                summary: item.contentSnippet || item.content || "",
            } as FeedItem;
        });
    } catch (error) {
        console.error(`Failed to parse RSS feed from ${url}:`, error);
        return [];
    }
}
