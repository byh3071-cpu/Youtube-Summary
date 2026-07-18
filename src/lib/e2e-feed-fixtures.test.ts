import { describe, expect, it } from "vitest";
import type { FeedSource } from "./sources";
import { buildE2eFeedFixtures, shouldUseE2eFeedFixtures } from "./e2e-feed-fixtures";

const sources: FeedSource[] = [
  { id: "UCfixture", name: "Fixture Channel", type: "YouTube", category: "AI" },
  { id: "https://example.com/rss", name: "Fixture RSS", type: "RSS", category: "AI" },
];

describe("E2E feed fixtures", () => {
  it("requires both the CI and explicit fixture flags", () => {
    expect(shouldUseE2eFeedFixtures({ CI: "true", FOCUS_FEED_E2E_FIXTURES: "1" })).toBe(true);
    expect(shouldUseE2eFeedFixtures({ CI: "true" })).toBe(false);
    expect(shouldUseE2eFeedFixtures({ FOCUS_FEED_E2E_FIXTURES: "1" })).toBe(false);
    expect(shouldUseE2eFeedFixtures({ CI: "false", FOCUS_FEED_E2E_FIXTURES: "1" })).toBe(false);
  });

  it("covers longform, shortform, live, RSS, and queue-sized YouTube data", () => {
    const items = buildE2eFeedFixtures(sources);
    const youtubeItems = items.filter((item) => item.source === "YouTube");
    const rssItems = items.filter((item) => item.source === "RSS");

    expect(youtubeItems).toHaveLength(5);
    expect(rssItems).toHaveLength(2);
    expect(youtubeItems.filter((item) => (item.durationSeconds ?? 0) <= 60)).toHaveLength(2);
    expect(youtubeItems.filter((item) => (item.durationSeconds ?? 0) > 60)).toHaveLength(3);
    expect(youtubeItems.filter((item) => item.isLive)).toHaveLength(1);
    expect(new Set(youtubeItems.map((item) => item.id)).size).toBe(youtubeItems.length);
    expect(items.every((item) => item.category === "AI")).toBe(true);
  });
});
