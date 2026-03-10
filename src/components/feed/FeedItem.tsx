import { FeedItem as FeedItemType } from "@/types/feed";
import Image from "next/image";

interface Props {
    item: FeedItemType;
}

export default function FeedItem({ item }: Props) {
    // 날짜 포맷팅 (예: 2026-03-11)
    const formattedDate = new Intl.DateTimeFormat('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    }).format(new Date(item.pubDate));

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group block py-3 border-b border-(--notion-border) hover:bg-(--notion-hover) -mx-4 px-4 rounded-lg transition-colors"
        >
            <div className="flex gap-4 items-start">
                {/* Source Icon Indicator (Minimal) */}
                <div className="mt-1 shrink-0">
                    {item.source === 'YouTube' ? (
                        <div className="w-5 h-5 rounded bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold">
                            YT
                        </div>
                    ) : (
                        <div className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                            RSS
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-(--notion-fg) group-hover:underline underline-offset-2 decoration-(--notion-border) leading-tight mb-1">
                        {item.title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-(--notion-fg)/60">
                        <span className="font-medium">{item.sourceName}</span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                    </div>

                    {/* RSS인 경우 요약 텍스트 한 줄 추가 (Notion Description Style) */}
                    {item.source === 'RSS' && item.summary && (
                        <p className="mt-1.5 text-sm text-(--notion-fg)/70 line-clamp-2 leading-relaxed">
                            {item.summary.replace(/<[^>]*>?/gm, '') /* HTML 태그 제거 */}
                        </p>
                    )}
                </div>

                {/* 썸네일 노출 (최소화 - 유튜브만, 원할 경우만) */}
                {item.source === 'YouTube' && item.thumbnail && (
                    <div className="hidden sm:block shrink-0 w-24 h-14 rounded overflow-hidden bg-(--notion-gray) border border-(--notion-border) relative">
                        <Image
                            src={item.thumbnail}
                            alt=""
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
