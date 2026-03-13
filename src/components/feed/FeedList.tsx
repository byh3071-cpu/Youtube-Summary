import { FeedItem as FeedItemType } from "@/types/feed";
import FeedItemComponent from "./FeedItem";
import YouTubeCard from "./YouTubeCard";
import { AutoAnimateList } from "@/components/ui/AutoAnimateList";
import { Coffee, Rss, Youtube } from "lucide-react";
import type { BookmarkEntry } from "./FeedClientContainer";
import Image from "next/image";

type ViewMode = "all" | "youtube" | "rss";

interface Props {
    items: FeedItemType[];
    hasActiveFilters?: boolean;
    selectedSourceName?: string;
    useTickerLayout?: boolean;
    viewMode?: ViewMode;
    bookmarks?: BookmarkEntry[];
    onBookmarkChange?: () => void;
}

function EmptyBlock({ message }: { message: string }) {
    return (
        <div className="rounded-xl border border-dashed border-(--notion-border) bg-(--notion-gray)/30 py-6 text-center text-sm text-(--notion-fg)/45">
            {message}
        </div>
    );
}

export default function FeedList({ items, hasActiveFilters = false, selectedSourceName, useTickerLayout = true, viewMode = "all", bookmarks = [], onBookmarkChange }: Props) {
    const youtubeItems = (items ?? []).filter((i) => i.source === "YouTube");
    const rssItems = (items ?? []).filter((i) => i.source === "RSS");
    const hasAny = items && items.length > 0;

    if (!hasAny) {
        if (hasActiveFilters) {
            return (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-(--notion-border) py-12 text-center text-(--notion-fg)/50">
                    <div className="relative mb-4 h-28 w-28 sm:h-32 sm:w-32">
                        <Image
                            src="/images/empty/Empty-filter.png"
                            alt="현재 필터에 해당하는 피드가 없음을 나타내는 일러스트"
                            fill
                            sizes="128px"
                            className="object-contain"
                            priority
                        />
                    </div>
                    <p className="mb-1 font-medium">
                        현재 필터에 맞는 피드가 없습니다.
                    </p>
                    <p className="text-sm text-(--notion-fg)/45">
                        필터를 줄이거나 다른 키워드를 추가해 보세요.
                    </p>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-(--notion-border) py-12 text-center text-(--notion-fg)/50">
                <Coffee className="mb-4 opacity-50" size={32} />
                <p className="mb-1 font-medium">
                    {selectedSourceName ? `${selectedSourceName}에서 표시할 피드가 없습니다.` : "표시할 피드가 아직 없습니다."}
                </p>
                <p className="text-sm text-(--notion-fg)/45">
                    {selectedSourceName ? "선택한 소스에 새 항목이 올라오면 여기에서 바로 확인할 수 있습니다." : "잠시 후 새로고침해서 최신 소스를 다시 불러와 보세요."}
                </p>
            </div>
        );
    }

    if (!useTickerLayout) {
        return (
            <section className="overflow-hidden rounded-2xl border border-(--notion-border) bg-(--notion-bg)">
                <div className="border-b border-(--notion-border) bg-(--notion-gray) px-4 py-3 text-sm text-(--notion-fg)/60 sm:px-5">
                    최신순으로 정렬된 피드입니다. 항목을 클릭하면 원문으로 이동합니다.
                </div>
                <div className="flex flex-col">
                    {items.map((item) => (
                        <FeedItemComponent key={`${item.source}:${item.sourceId}:${item.id}`} item={item} />
                    ))}
                </div>
            </section>
        );
    }

    // '전체' 보기 모드일 때 해당 소스가 아예 없으면 섹션 자체를 숨김 (사용자 요청: RSS 선택 시 유튜브 칸 삭제)
    const showYoutube = (viewMode === "all" ? youtubeItems.length > 0 : viewMode === "youtube");
    const showRss = (viewMode === "all" ? rssItems.length > 0 : viewMode === "rss");

    return (
        <section className="space-y-6">
            {showYoutube && (
                <div className="overflow-hidden rounded-2xl border border-(--notion-border) bg-(--notion-bg)">
                    <div className="flex items-center justify-between gap-2 border-b border-(--notion-border) bg-(--notion-gray) px-4 py-3 text-[13px] text-(--notion-fg)/70 sm:px-5">
                        <div className="flex items-center gap-2">
                            <Youtube className="h-4 w-4 text-red-500" />
                            <span className="font-semibold">유튜브 최신</span>
                        </div>
                        <span className="text-[12px] text-(--notion-fg)/55">
                            최신순 정렬
                        </span>
                    </div>
                    <div className="px-3 py-3 sm:px-4 sm:py-4">
                        {youtubeItems.length === 0 ? (
                            <EmptyBlock message="이번 필터에 해당하는 유튜브 영상이 없습니다." />
                        ) : (
                            <AutoAnimateList as="ul" className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                                {youtubeItems.map((item) => {
                                    const b = item.id ? bookmarks.find((x) => x.video_id === item.id) : null;
                                    return (
                                        <li key={`${item.source}:${item.sourceId}:${item.id}`}>
                                            <YouTubeCard
                                                item={item}
                                                bookmark={b}
                                                onBookmarkChange={onBookmarkChange}
                                            />
                                        </li>
                                    );
                                })}
                            </AutoAnimateList>
                        )}
                    </div>
                </div>
            )}

            {showRss && (
                <div className="overflow-hidden rounded-2xl border border-(--notion-border) bg-(--notion-bg)">
                    <div className="flex items-center gap-2 border-b border-(--notion-border) bg-(--notion-gray) px-4 py-3 text-sm text-(--notion-fg)/60 sm:px-5">
                        <Rss className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">RSS·뉴스 최신</span>
                        <span className="text-(--notion-fg)/45">· 최신순</span>
                    </div>
                    <AutoAnimateList as="div" className="flex flex-col">
                        {rssItems.length === 0 ? (
                            <EmptyBlock message="이번 필터에 해당하는 RSS·뉴스가 없습니다." />
                        ) : (
                            rssItems.map((item) => {
                                const rssBookmarkId = "rss:" + item.link;
                                const b = bookmarks.find((x) => x.video_id === rssBookmarkId) ?? null;
                                return (
                                    <FeedItemComponent
                                        key={`${item.source}:${item.sourceId}:${item.id}`}
                                        item={item}
                                        bookmark={b}
                                        onBookmarkChange={onBookmarkChange}
                                    />
                                );
                            })
                        )}
                    </AutoAnimateList>
                </div>
            )}
        </section>
    );
}
