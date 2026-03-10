import { FeedItem } from "../types/feed";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const REVALIDATE_SECONDS = 7200;
let hasWarnedAboutMissingApiKey = false;
let hasWarnedAboutInvalidApiKey = false;
let hasWarnedAboutYouTubeFailure = false;

export type YouTubeFetchStatus = "ready" | "missing_api_key" | "invalid_api_key" | "request_failed";

export interface YouTubeFeedResult {
  items: FeedItem[];
  status: YouTubeFetchStatus;
}

interface YouTubePlaylistItem {
  id?: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    resourceId?: {
      videoId?: string;
    };
    thumbnails?: {
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
}

interface YouTubePlaylistResponse {
  items?: YouTubePlaylistItem[];
}

function hasUsableApiKey(apiKey: string | undefined): apiKey is string {
  if (!apiKey) {
    return false;
  }

  const normalizedApiKey = apiKey.trim();

  return normalizedApiKey !== "" && normalizedApiKey !== "your_youtube_api_key_here";
}

function logMissingApiKeyWarning() {
  if (hasWarnedAboutMissingApiKey) {
    return;
  }

  hasWarnedAboutMissingApiKey = true;
  console.warn("YOUTUBE_API_KEY is missing or using the example placeholder. Skipping YouTube fetch.");
}

function logInvalidApiKeyWarning() {
  if (hasWarnedAboutInvalidApiKey) {
    return;
  }

  hasWarnedAboutInvalidApiKey = true;
  console.warn("YOUTUBE_API_KEY is invalid. Skipping YouTube sources until a valid key is configured.");
}

function logGenericYouTubeWarning(channelName: string, status: number) {
  if (hasWarnedAboutYouTubeFailure) {
    return;
  }

  hasWarnedAboutYouTubeFailure = true;
  console.warn(`YouTube feed request failed for ${channelName} with status ${status}.`);
}

// 주어진 Channel ID (UC...)를 Uploads Playlist ID (UU...)로 변환
export function getUploadsPlaylistId(channelId: string): string {
  if (channelId.startsWith("UC")) {
    return "UU" + channelId.substring(2);
  }
  // 이미 UU로 시작하거나 형식이 다를 경우 그대로 반환
  return channelId;
}

export function getYouTubeConfigurationStatus(): YouTubeFetchStatus {
  if (!hasUsableApiKey(YOUTUBE_API_KEY)) {
    return "missing_api_key";
  }

  return "ready";
}

export async function fetchYouTubeFeed(channelId: string, channelName: string): Promise<YouTubeFeedResult> {
  if (!hasUsableApiKey(YOUTUBE_API_KEY)) {
    logMissingApiKeyWarning();
    return { items: [], status: "missing_api_key" };
  }

  const playlistId = getUploadsPlaylistId(channelId);
  const maxResults = 10; // 최근 10개 영상
  const searchParams = new URLSearchParams({
    part: "snippet",
    playlistId,
    maxResults: String(maxResults),
    key: YOUTUBE_API_KEY,
  });
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?${searchParams.toString()}`;

  try {
    // Next.js 15의 fetch 캐싱: { next: { revalidate: 7200 } } (2시간)
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS }
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 400 && errorText.includes("API key not valid")) {
        logInvalidApiKeyWarning();
        return { items: [], status: "invalid_api_key" };
      }

      logGenericYouTubeWarning(channelName, response.status);
      return { items: [], status: "request_failed" };
    }

    const data = (await response.json()) as YouTubePlaylistResponse;
    
    if (!data.items) {
      return { items: [], status: "ready" };
    }

    // 결과를 공통 FeedItem 형식으로 매핑
    const items = data.items.flatMap((item) => {
      const snippet = item.snippet;

      if (!snippet?.title || !snippet.publishedAt) {
        return [];
      }

      // snippet.resourceId.videoId 가 실제 비디오 ID
      const videoId = snippet.resourceId?.videoId;

      if (!videoId) {
        return [];
      }
      
      return [{
        id: videoId,
        title: snippet.title,
        link: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        pubDate: snippet.publishedAt,
        source: "YouTube",
        sourceId: channelId,
        sourceName: channelName,
        // 필요 시 썸네일도 옵셔널하게 사용
        thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url
      } satisfies FeedItem];
    });

    return { items, status: "ready" };

  } catch (error) {
    if (!hasWarnedAboutYouTubeFailure) {
      hasWarnedAboutYouTubeFailure = true;
      console.warn(`Failed to fetch YouTube feed for ${channelName}.`, error);
    }

    return { items: [], status: "request_failed" };
  }
}
