import { FeedItem } from "../types/feed";

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
