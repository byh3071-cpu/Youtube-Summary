import { FeedItem } from "../types/feed";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

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
  
  // API URL 구성
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;

  try {
    // Next.js 15의 fetch 캐싱: { next: { revalidate: 7200 } } (2시간)
    const response = await fetch(url, {
      next: { revalidate: 7200 }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`YouTube API error for ${channelName}:`, errorData);
      return [];
    }

    const data = await response.json();
    
    if (!data.items) {
      return [];
    }

    // 결과를 공통 FeedItem 형식으로 매핑
    return data.items.map((item: any) => {
      const snippet = item.snippet;
      // snippet.resourceId.videoId 가 실제 비디오 ID
      const videoId = snippet.resourceId?.videoId;
      
      return {
        id: videoId || snippet.id, // videoId 폴백 처리
        title: snippet.title,
        link: `https://www.youtube.com/watch?v=${videoId}`,
        pubDate: snippet.publishedAt,
        source: "YouTube",
        sourceName: channelName,
        // 필요 시 썸네일도 옵셔널하게 사용
        thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url
      } as FeedItem;
    });

  } catch (error) {
    console.error(`Failed to fetch YouTube feed for ${channelName}:`, error);
    return [];
  }
}
