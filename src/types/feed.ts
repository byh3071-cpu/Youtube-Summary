export interface FeedItem {
    id: string;          // 고유 식별자 (Video ID 또는 URL)
    title: string;       // 콘텐츠 제목
    link: string;        // 원본 링크
    pubDate: string;     // ISO 8601 날짜 문자열
    source: "YouTube" | "RSS";  // 출처 타입
    sourceId: string;    // 채널 ID 또는 RSS URL
    sourceName: string;  // 채널명 또는 블로그명
    summary?: string;    // RSS 요약 (유튜브의 경우 생략 가능)
    thumbnail?: string;  // 썸네일 이미지 URL (선택사항)
    tags?: string[];     // 키워드 필터 등에서 활용할 태그 배열
}

export interface YouTubeChannel {
    id: string;          // 고유 식별자 (주로 UC... 형식의 채널 ID)
    name: string;        // 채널명 (예: 일잘러 장피엠)
    handle?: string;     // @handle 형식 (UI 표시용)
}
