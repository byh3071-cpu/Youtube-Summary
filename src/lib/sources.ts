export interface FeedSource {
    id: string;
    name: string;
    type: "YouTube" | "RSS";
}

export const defaultSources: FeedSource[] = [
    { id: "UCSkpTOEl_zW6b4Y7M_Prefg", name: "일잘러 장피엠", type: "YouTube" },
    { id: "UCUpJs89fSBXNolQGOYKn0YQ", name: "노마드 코더 (Nomad Coders)", type: "YouTube" },
    { id: "UCt2wAAXgm87ACiQnDHQEW6Q", name: "테디노트 (TeddyNote)", type: "YouTube" },
    { id: "UCCU2H8fnVx20POKCzFm-G5Q", name: "드로우앤드류 (DrawAndrew)", type: "YouTube" },
    { id: "https://news.hada.io/rss/news", name: "GeekNews", type: "RSS" },
    { id: "https://openai.com/blog/rss.xml", name: "OpenAI Blog", type: "RSS" },
];

export function getSourceById(sourceId?: string): FeedSource | undefined {
    if (!sourceId) {
        return undefined;
    }

    return defaultSources.find((source) => source.id === sourceId);
}
