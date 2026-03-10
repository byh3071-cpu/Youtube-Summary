import { FeedItem as FeedItemType } from "@/types/feed";
import Image from "next/image";

interface Props {
    item: FeedItemType;
}

export default function FeedItem({ item }: Props) {
    const publishedAt = new Date(item.pubDate);
    const hasValidDate = Number.isFinite(publishedAt.getTime());
    const cleanSummary = item.summary?.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();

    // 날짜 포맷팅 (예: 2026-03-11)
    const formattedDate = hasValidDate
        ? new Intl.DateTimeFormat('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        }).format(publishedAt)
        : "날짜 미상";

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${item.sourceName}의 ${item.title} 열기`}
            className="group -mx-2 block rounded-xl border-b border-(--notion-border) px-2 py-3 transition-colors hover:bg-(--notion-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--notion-fg)/20 sm:-mx-4 sm:px-4"
        >
            <div className="flex items-start gap-3 sm:gap-4">
                {/* Source Icon Indicator (Minimal) */}
                <div className="mt-1 shrink-0">
                    {item.source === 'YouTube' ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-red-500/10 text-[10px] font-bold text-red-600">
                            YT
                        </div>
                    ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/10 text-[10px] font-bold text-blue-600">
                            RSS
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className="mb-1 break-words text-base font-medium leading-tight text-(--notion-fg) decoration-(--notion-border) underline-offset-2 group-hover:underline">
                        {item.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--notion-fg)/60">
                        <span className="font-medium">{item.sourceName}</span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                    </div>

                    {/* RSS인 경우 요약 텍스트 한 줄 추가 (Notion Description Style) */}
                    {item.source === 'RSS' && cleanSummary && (
                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-(--notion-fg)/70">
                            {cleanSummary}
                        </p>
                    )}
                </div>

                {/* 썸네일 노출 (최소화 - 유튜브만, 원할 경우만) */}
                {item.source === 'YouTube' && item.thumbnail && (
                    <div className="relative hidden h-14 w-24 shrink-0 overflow-hidden rounded border border-(--notion-border) bg-(--notion-gray) sm:block">
                        <Image
                            src={item.thumbnail}
                            alt={`${item.sourceName} 썸네일`}
                            fill
                            sizes="96px"
                            className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                    </div>
                )}
            </div>
        </a>
    );
}
