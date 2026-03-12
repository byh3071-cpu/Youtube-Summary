import type { FeedSource } from "./sources";

export const CUSTOM_SOURCES_COOKIE_NAME = "focus_feed_sources";
export const CUSTOM_SOURCES_MAX_AGE = 60 * 60 * 24 * 365; // 1년

export function getCustomSourcesFromCookie(cookieValue: string | undefined): FeedSource[] {
  if (!cookieValue) return [];
  try {
    const decoded = decodeURIComponent(cookieValue.trim());
    const parsed = JSON.parse(decoded) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FeedSource =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as FeedSource).id === "string" &&
        typeof (item as FeedSource).name === "string" &&
        (item as FeedSource).type === "YouTube" &&
        typeof (item as FeedSource).category === "string"
    );
  } catch {
    return [];
  }
}

export function buildCustomSourcesCookie(sources: FeedSource[]): string {
  const value = encodeURIComponent(JSON.stringify(sources));
  return `${CUSTOM_SOURCES_COOKIE_NAME}=${value}; path=/; max-age=${CUSTOM_SOURCES_MAX_AGE}; SameSite=Lax`;
}

/** 가져오기 시 기존 목록과 합칠 때, id 기준 중복 제거 (기존 유지 + 새 항목만 추가) */
export function mergeCustomSources(existing: FeedSource[], incoming: FeedSource[]): FeedSource[] {
  const idSet = new Set(existing.map((s) => s.id));
  const added = incoming.filter((s) => typeof s?.id === "string" && !idSet.has(s.id));
  return [...existing, ...added];
}
