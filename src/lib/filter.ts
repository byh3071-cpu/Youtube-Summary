import { FeedItem } from "../types/feed";
import type { FeedCategory } from "../types/feed";

/**
 * 주어진 피드 목록을 사용자의 관심사(키워드) 배열에 맞게 필터링합니다.
 * 키워드가 비어있다면 전체 목록을 반환합니다.
 */
export function filterFeedByKeywords(items: FeedItem[], keywords: string[]): FeedItem[] {
    if (!keywords || keywords.length === 0) {
        return items;
    }

    const lowerCaseKeywords = keywords.map(k => k.toLowerCase());

    return items.filter(item => {
        const searchTarget = `${item.title} ${item.summary || ''} ${item.sourceName}`.toLowerCase();

        // 하나라도 매칭되면 노출 (OR 조건)
        return lowerCaseKeywords.some(keyword => searchTarget.includes(keyword));
    });
}

/**
 * 카테고리 기준으로 피드를 필터링합니다.
 * category가 없으면 전체, 있으면 해당 카테고리만 반환합니다.
 */
export function filterFeedByCategory(items: FeedItem[], category: FeedCategory | null): FeedItem[] {
    if (!category) {
        return items;
    }
    return items.filter((item) => item.category === category);
}
