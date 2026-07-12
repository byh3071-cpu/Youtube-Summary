import { FeedItem as FeedItemType } from "@/types/feed";
import Image from "next/image";
import SummarizeButton from "./SummarizeButton";
import AddToRadioButton from "./AddToRadioButton";
import BookmarkButton from "./BookmarkButton";
import ContentStateControl from "./ContentStateControl";
import { contentIdForItem } from "@/types/content-state";
import type { ContentStateInfo } from "@/app/actions/content-state";
import type { BookmarkEntry } from "./FeedClientContainer";
import { ExternalLink, Rss, Youtube } from "lucide-react";

interface Props {
    item: FeedItemType;
    bookmark?: BookmarkEntry | null;
    onBookmarkChange?: () => void;
    contentState?: ContentStateInfo;
    onContentStateChange?: () => void;
}

const RSS_BOOKMARK_PREFIX = "rss:";

export default function FeedItem({ item, bookmark, onBookmarkChange, contentState, onContentStateChange }: Props) {
    // RSS 항목의 content_id(=rss:<link>). content_states 키·필터(isItemVisibleUnderStateFilter)와 동일해야 한다.
    const rssContentId = contentIdForItem(item);
    const publishedAt = new Date(item.pubDate);
    const hasValidDate = Number.isFinite(publishedAt.getTime());
    const cleanSummary = item.summary?.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
    const isYouTube = item.source === "YouTube";

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
            className="group block border-b border-(--notion-border) bg-(--notion-bg) px-4 py-4 transition-colors hover:bg-(--notion-gray)/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--focus-accent)/60 last:border-b-0 sm:px-5 sm:py-5"
        >
            <div className="flex items-start gap-3 sm:gap-4">
                <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isYouTube
                            ? "bg-red-500/10 text-red-600 dark:text-red-300"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-300"
                    }`}
                    aria-hidden="true"
                >
                    {isYouTube ? <Youtube size={17} /> : <Rss size={17} />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--notion-fg)/55">
                        <span className="truncate font-semibold text-(--notion-fg)/75">{item.sourceName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formattedDate}</span>
                        {item.source === "RSS" && (onBookmarkChange || onContentStateChange) && (
                            <span
                                className="ml-auto flex shrink-0 items-center gap-1"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            >
                                {onContentStateChange && rssContentId && (
                                    <ContentStateControl
                                        contentId={rssContentId}
                                        sourceId={item.sourceId}
                                        sourceType="RSS"
                                        state={contentState?.state}
                                        onChange={onContentStateChange}
                                    />
                                )}
                                {onBookmarkChange && (
                                    <BookmarkButton
                                        videoId={`${RSS_BOOKMARK_PREFIX}${item.link}`}
                                        videoTitle={item.title}
                                        highlight={item.summary ?? item.title}
                                        isBookmarked={!!bookmark}
                                        bookmarkId={bookmark?.id ?? null}
                                        onBookmarkChange={onBookmarkChange}
                                    />
                                )}
                            </span>
                        )}
                    </div>

                    <h3 className="mb-1 mt-2 wrap-break-word text-base font-semibold leading-snug text-(--notion-fg) decoration-(--notion-border) underline-offset-2 group-hover:underline sm:text-[17px]">
                        {item.title}
                    </h3>

                    {item.source === 'RSS' && cleanSummary && (
                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-(--notion-fg)/65">
                            {cleanSummary}
                        </p>
                    )}

                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-(--notion-fg)/55 transition-colors group-hover:text-(--notion-fg)/80">
                        원문 보기
                        <ExternalLink size={12} />
                    </span>

                    {/* YouTube인 경우 라디오 추가 + AI 요약 버튼 */}
                    {item.source === 'YouTube' && item.id && (
                        <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full bg-(--notion-gray)/70 px-2 py-1">
                            <AddToRadioButton videoId={item.id} title={item.title} />
                            <SummarizeButton videoId={item.id} />
                        </div>
                    )}
                </div>

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
