import { FeedItem as FeedItemType } from "@/types/feed";
import FeedItemComponent from "./FeedItem";
import { Coffee } from "lucide-react";

interface Props {
    items: FeedItemType[];
    hasActiveFilters?: boolean;
}

export default function FeedList({ items, hasActiveFilters = false }: Props) {
    if (!items || items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-(--notion-border) py-12 text-center text-(--notion-fg)/50">
                <Coffee className="mb-4 opacity-50" size={32} />
                <p className="mb-1 font-medium">
                    {hasActiveFilters ? "현재 필터에 맞는 피드가 없습니다." : "표시할 피드가 아직 없습니다."}
                </p>
                <p className="text-sm text-(--notion-fg)/45">
                    {hasActiveFilters ? "필터를 줄이거나 다른 키워드를 추가해 보세요." : "잠시 후 새로고침해서 최신 소스를 다시 불러와 보세요."}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            {items.map((item) => (
                <FeedItemComponent key={item.id} item={item} />
            ))}
        </div>
    );
}
