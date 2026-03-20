import { FeedItem } from "../types/feed";
import type { FeedCategory } from "../types/feed";

/**
 * 주어진 피드 목록을 사용자의 관심사(키워드) 배열에 맞게 필터링합니다.
 * 키워드가 비어있다면 전체 목록을 반환합니다.
 */
/** ASCII 전용 키워드(영어 등)는 단어 경계 매칭, 그 외(한국어 등)는 포함 매칭 */
function keywordMatches(keyword: string, target: string): boolean {
    if (/^[a-zA-Z0-9 ]+$/.test(keyword)) {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escaped}\\b`, "i").test(target);
    }
    return target.includes(keyword);
}

export function filterFeedByKeywords(items: FeedItem[], keywords: string[]): FeedItem[] {
    if (!keywords || keywords.length === 0) {
        return items;
    }

    const lowerCaseKeywords = keywords.map(k => k.toLowerCase());

    return items.filter(item => {
        const searchTarget = `${item.title} ${item.summary || ''} ${item.sourceName}`.toLowerCase();

        // 하나라도 매칭되면 노출 (OR 조건)
        return lowerCaseKeywords.some(keyword => keywordMatches(keyword, searchTarget));
    });
}

/**
 * 트렌드 키워드 하나로 피드를 임시 필터링합니다.
 * (요즘 뜨는 키워드 클릭 시 사용, 필터에 저장하지 않음)
 */
export function filterFeedByTrendKeyword(items: FeedItem[], keyword: string | null): FeedItem[] {
  if (!keyword || !keyword.trim()) return items;
  const k = keyword.toLowerCase().trim();
  const searchTarget = (item: FeedItem) =>
    `${item.title} ${item.summary || ""} ${item.sourceName}`.toLowerCase();
  return items.filter((item) => searchTarget(item).includes(k));
}

/**
 * 검색어로 피드를 필터링합니다.
 * 제목, 소스 이름, 요약에서 검색어가 포함된 항목만 반환합니다.
 */
export function filterFeedBySearch(items: FeedItem[], query: string): FeedItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.sourceName.toLowerCase().includes(q) ||
    (item.summary?.toLowerCase().includes(q) ?? false)
  );
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
