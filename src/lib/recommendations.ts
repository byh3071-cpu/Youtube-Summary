import type { FeedItem } from "@/types/feed";

/**
 * 사용자의 목표/관심사 텍스트로 피드 아이템을 간이 스코어링.
 * AI 브리핑 호출 전 로컬에서 빠르게 관련 콘텐츠를 뽑아내는 용도.
 */
export function computeRecommendations(
  items: FeedItem[],
  goals: string,
  max = 3,
): FeedItem[] {
  const trimmed = goals.trim();
  if (!trimmed) return [];

  const loweredGoals = trimmed.toLowerCase();
  const rawKeywords = loweredGoals
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const keywords =
    rawKeywords.length > 0
      ? rawKeywords
      : loweredGoals.split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];

  const scored = items.map((item) => {
    const text =
      `${item.title} ${item.summary || ""} ${item.sourceName}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (kw && text.includes(kw)) score += 2;
    }
    if (item.category === "AI") score += 1;
    return { item, score };
  });

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ item }) => item);
}
