import Image from "next/image";
import { FeedItem as FeedItemType } from "@/types/feed";
import AddToRadioButton from "./AddToRadioButton";
import SummarizeButton from "./SummarizeButton";

function formatTimeAgo(pubDate: string): string {
  const date = new Date(pubDate);
  if (!Number.isFinite(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  if (diff < min) return "방금 전";
  if (diff < hour) return `${Math.floor(diff / min)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < week) return `${Math.floor(diff / day)}일 전`;
  if (diff < month) return `${Math.floor(diff / week)}주 전`;
  return `${Math.floor(diff / month)}개월 전`;
}

interface Props {
  item: FeedItemType;
}

export default function YouTubeCard({ item }: Props) {
  const timeAgo = formatTimeAgo(item.pubDate);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-(--notion-border) bg-(--notion-bg) transition-shadow hover:shadow-md">
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col"
        aria-label={`${item.sourceName} - ${item.title}`}
      >
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-(--notion-gray)">
          {item.thumbnail ? (
            <Image
              src={item.thumbnail}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-(--notion-fg)/30">
              <span className="text-sm">No thumbnail</span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-3">
          <h3 className="mb-1 line-clamp-2 text-sm font-medium leading-snug text-(--notion-fg) group-hover:text-(--notion-fg)/90">
            {item.title}
          </h3>
          <p className="mb-2 text-xs text-(--notion-fg)/55">
            {item.sourceName}
          </p>
          {timeAgo && (
            <p className="text-xs text-(--notion-fg)/45">
              {timeAgo}
            </p>
          )}
        </div>
      </a>
      {item.id && (
        <div
          className="flex flex-wrap gap-2 border-t border-(--notion-border) px-3 py-2"
          onClick={(e) => e.preventDefault()}
        >
          <AddToRadioButton videoId={item.id} title={item.title} />
          <SummarizeButton videoId={item.id} />
        </div>
      )}
    </article>
  );
}
