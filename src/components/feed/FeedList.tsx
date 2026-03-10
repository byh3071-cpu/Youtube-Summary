import { FeedItem as FeedItemType } from "@/types/feed";
import FeedItemComponent from "./FeedItem";
import { Coffee } from "lucide-react";

interface Props {
    items: FeedItemType[];
    hasActiveFilters?: boolean;
    selectedSourceName?: string;
}

export default function FeedList({ items, hasActiveFilters = false, selectedSourceName }: Props) {
    if (!items || items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-(--notion-border) py-12 text-center text-(--notion-fg)/50">
                <Coffee className="mb-4 opacity-50" size={32} />
                <p className="mb-1 font-medium">
                    {hasActiveFilters ? "현재 필터에 맞는 피드가 없습니다." : selectedSourceName ? `${selectedSourceName}에서 표시할 피드가 없습니다.` : "표시할 피드가 아직 없습니다."}
                </p>
                <p className="text-sm text-(--notion-fg)/45">
                    {hasActiveFilters ? "필터를 줄이거나 다른 키워드를 추가해 보세요." : selectedSourceName ? "선택한 소스에 새 항목이 올라오면 여기에서 바로 확인할 수 있습니다." : "잠시 후 새로고침해서 최신 소스를 다시 불러와 보세요."}
                </p>
            </div>
        );
    }

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
