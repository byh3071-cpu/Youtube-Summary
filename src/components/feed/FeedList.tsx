import { FeedItem as FeedItemType } from "@/types/feed";
import FeedItemComponent from "./FeedItem";
import { Coffee } from "lucide-react";

interface Props {
    items: FeedItemType[];
}

export default function FeedList({ items }: Props) {
    if (!items || items.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-[var(--notion-fg)]/50">
                <Coffee className="mb-4 opacity-50" size={32} />
                <p>새로운 피드가 없습니다. 필터를 조정해 보세요.</p>
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
