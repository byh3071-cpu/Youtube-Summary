import { FeedItem } from "../types/feed";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const REVALIDATE_SECONDS = 7200;

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

// 주어진 Channel ID (UC...)를 Uploads Playlist ID (UU...)로 변환
export function getUploadsPlaylistId(channelId: string): string {
  if (channelId.startsWith("UC")) {
    return "UU" + channelId.substring(2);
  }
  // 이미 UU로 시작하거나 형식이 다를 경우 그대로 반환
  return channelId;
}

export async function fetchYouTubeFeed(channelId: string, channelName: string): Promise<FeedItem[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn("YOUTUBE_API_KEY is not defined. Skipping YouTube fetch.");
    return [];
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
      console.error(`YouTube API error for ${channelName}: ${errorText}`);
      return [];
    }

    const data = (await response.json()) as YouTubePlaylistResponse;
    
    if (!data.items) {
      return [];
    }

    // 결과를 공통 FeedItem 형식으로 매핑
    return data.items.flatMap((item) => {
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
        sourceName: channelName,
        // 필요 시 썸네일도 옵셔널하게 사용
        thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url
      } satisfies FeedItem];
    });

  } catch (error) {
    console.error(`Failed to fetch YouTube feed for ${channelName}:`, error);
    return [];
  }
}
