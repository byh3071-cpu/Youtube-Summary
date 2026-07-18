import type { FeedItem } from "@/types/feed";
import type { FeedSource } from "./sources";

interface E2eFixtureEnvironment {
  CI?: string;
  FOCUS_FEED_E2E_FIXTURES?: string;
}

const FIXTURE_THUMBNAIL = "/images/og/og-image.png";
const FIXTURE_AVATAR = "/focus-feed-logo-v2.png";

/**
 * CI에서 외부 YouTube/RSS 자격 증명 없이 브라우저 동작을 검증할 때만 활성화한다.
 * 명시적인 fixture 플래그와 CI 플래그가 모두 필요하므로 일반 개발·배포 환경에서는
 * 실수로 fixture 데이터가 노출되지 않는다.
 */
export function shouldUseE2eFeedFixtures(
  env: E2eFixtureEnvironment = {
    CI: process.env.CI,
    FOCUS_FEED_E2E_FIXTURES: process.env.FOCUS_FEED_E2E_FIXTURES,
  },
): boolean {
  return env.CI === "true" && env.FOCUS_FEED_E2E_FIXTURES === "1";
}

function fixtureVideoId(kind: "LG" | "SH" | "LV", sourceIndex: number, itemIndex: number): string {
  return `FF${kind}${sourceIndex}${itemIndex}`.padEnd(11, "0").slice(0, 11);
}

function fixtureDate(sequence: number): string {
  return new Date(Date.UTC(2026, 6, 17, 12, 0) - sequence * 60_000).toISOString();
}

function youtubeItem(
  source: FeedSource,
  sourceIndex: number,
  itemIndex: number,
  kind: "longform" | "shortform" | "live",
  sequence: number,
): FeedItem {
  const kindCode = kind === "longform" ? "LG" : kind === "shortform" ? "SH" : "LV";
  const id = fixtureVideoId(kindCode, sourceIndex, itemIndex);
  const kindLabel = kind === "longform" ? "롱폼" : kind === "shortform" ? "숏폼" : "라이브";

  return {
    id,
    title: `[E2E] ${source.name} ${kindLabel} ${itemIndex + 1}`,
    link: `https://www.youtube.com/watch?v=${id}`,
    pubDate: fixtureDate(sequence),
    source: "YouTube",
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    thumbnail: FIXTURE_THUMBNAIL,
    durationSeconds: kind === "shortform" ? 45 + itemIndex : 420 + itemIndex * 60,
    isLive: kind === "live",
    sourceAvatarUrl: source.avatarUrl ?? FIXTURE_AVATAR,
  };
}

function rssItem(
  source: FeedSource,
  sourceIndex: number,
  itemIndex: number,
  sequence: number,
): FeedItem {
  return {
    id: `e2e-rss-${sourceIndex}-${itemIndex}`,
    title: `[E2E] ${source.name} 기사 ${itemIndex + 1}`,
    link: `https://example.com/e2e/rss/${sourceIndex}/${itemIndex}`,
    pubDate: fixtureDate(sequence),
    source: "RSS",
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    summary: "외부 네트워크에 의존하지 않는 Focus Feed E2E 검증용 기사입니다.",
  };
}

/**
 * 홈 카드·롱폼·숏폼·라이브·라디오 대기열을 모두 검증할 수 있는 최소 정적 피드.
 */
export function buildE2eFeedFixtures(sources: FeedSource[]): FeedItem[] {
  let sequence = 0;

  return sources.flatMap((source, sourceIndex) => {
    if (source.type === "RSS") {
      return [0, 1].map((itemIndex) => rssItem(source, sourceIndex, itemIndex, sequence++));
    }

    return [
      youtubeItem(source, sourceIndex, 0, "longform", sequence++),
      youtubeItem(source, sourceIndex, 1, "longform", sequence++),
      youtubeItem(source, sourceIndex, 0, "shortform", sequence++),
      youtubeItem(source, sourceIndex, 1, "shortform", sequence++),
      youtubeItem(source, sourceIndex, 0, "live", sequence++),
    ];
  });
}
