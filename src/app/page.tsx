import { cookies } from "next/headers";
import AppLayout from "@/components/layout/AppLayout";
import FeedClientContainer from "@/components/feed/FeedClientContainer";
import FeedHeader from "@/components/feed/FeedHeader";
import { getMergedFeed } from "@/lib/feed";
import { defaultSources, FEED_CATEGORIES } from "@/lib/sources";
import { getCustomSourcesFromCookie, CUSTOM_SOURCES_COOKIE_NAME } from "@/lib/custom-sources-cookie";
import { resolveYouTubeChannel } from "@/lib/youtube";
import type { FeedCategory } from "@/types/feed";
import type { FeedSource } from "@/lib/sources";

export const revalidate = 7200; // 2 hours

interface HomeProps {
  searchParams?: Promise<{
    source?: string;
    category?: string;
    view?: string;
  }>;
}

function parseView(value: string | undefined): "all" | "youtube" | "rss" {
  if (value === "youtube" || value === "rss") return value;
  return "all";
}

function parseCategory(value: string | undefined): FeedCategory | null {
  if (!value) return null;
  return FEED_CATEGORIES.includes(value as FeedCategory) ? (value as FeedCategory) : null;
}

function mergeSources(defaultList: FeedSource[], custom: FeedSource[]): FeedSource[] {
  const existingIds = new Set(defaultList.map((s) => s.id));
  const extra = custom.filter((c) => !existingIds.has(c.id));
  return [...defaultList, ...extra];
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const selectedSourceId = resolvedSearchParams?.source;
  const initialView = parseView(resolvedSearchParams?.view);
  const cookieStore = await cookies();
  const customSources = getCustomSourcesFromCookie(cookieStore.get(CUSTOM_SOURCES_COOKIE_NAME)?.value);
  const mergedSources = mergeSources(defaultSources, customSources);

  // YouTube 채널 프로필 이미지(avatarUrl) 하이드레이션
  const hydratedSources: FeedSource[] = await Promise.all(
    mergedSources.map(async (source) => {
      if (source.type !== "YouTube" || source.avatarUrl) return source;
      // 채널 ID 형식(UC...)만 프로필 조회
      if (!source.id.startsWith("UC")) return source;
      const resolved = await resolveYouTubeChannel({ type: "channelId", channelId: source.id });
      if (resolved?.avatarUrl) {
        return { ...source, avatarUrl: resolved.avatarUrl };
      }
      return source;
    }),
  );

  const selectedSource = selectedSourceId ? hydratedSources.find((s) => s.id === selectedSourceId) : undefined;
  const initialCategory = parseCategory(resolvedSearchParams?.category);
  const showViewSwitcher = !selectedSource;

  const { items, sourceStatus } = await getMergedFeed(hydratedSources);
  const visibleItems = selectedSource
    ? items.filter((item) => item.sourceId === selectedSource.id)
    : items;
  const youtubeSources = hydratedSources.filter((s) => s.type === "YouTube");
  const rssSourceCount = defaultSources.filter((source) => source.type === "RSS").length;

  const customYouTubeSourceIds = customSources.map((s) => s.id);

  // 채널별 최신 영상 시간 (최근 표시용)
  const latestMap = new Map<string, string>();
  items.forEach((item) => {
    if (item.source !== "YouTube") return;
    const t = new Date(item.pubDate).getTime();
    if (Number.isFinite(t)) {
      const prev = latestMap.get(item.sourceId);
      if (!prev || new Date(prev).getTime() < t) {
        latestMap.set(item.sourceId, item.pubDate);
      }
    }
  });
  const latestVideoBySource = Object.fromEntries(latestMap);

  return (
    <AppLayout
      sourceStatus={sourceStatus}
      selectedSourceId={selectedSource?.id}
      selectedCategory={resolvedSearchParams?.category ?? undefined}
      youtubeSources={youtubeSources}
      customYouTubeSourceIds={customYouTubeSourceIds}
      latestVideoBySource={latestVideoBySource}
    >
      <FeedHeader
        selectedSource={selectedSource}
        visibleItemsCount={visibleItems.length}
        sourceStatus={sourceStatus}
        youtubeSourceCount={youtubeSources.length}
        rssSourceCount={rssSourceCount}
      />

      <FeedClientContainer
        initialItems={visibleItems}
        selectedSourceName={selectedSource?.name}
        initialCategory={initialCategory}
        initialView={initialView}
        showViewSwitcher={showViewSwitcher}
      />
    </AppLayout>
  );
}
