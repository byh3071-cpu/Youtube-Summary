import AppLayout from "@/components/layout/AppLayout";
import FeedClientContainer from "@/components/feed/FeedClientContainer";
import RefreshButton from "@/components/ui/RefreshButton";
import { getMergedFeed } from "@/lib/feed";
import { defaultSources } from "@/lib/sources";

export const revalidate = 7200; // 2 hours

export default async function Home() {
  // 서버 컴포넌트에서 데이터 페치 (getMergedFeed에 의해 캐시 적용됨)
  const items = await getMergedFeed();
  const youtubeSourceCount = defaultSources.filter((source) => source.type === "YouTube").length;
  const rssSourceCount = defaultSources.filter((source) => source.type === "RSS").length;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 border-b border-(--notion-border) pb-6 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Focus Feed</h1>
          <p className="text-sm leading-relaxed text-(--notion-fg)/60 sm:text-base">
            알고리즘 없이 텍스트 중심의 정제된 정보를 큐레이션 합니다.
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-(--notion-fg)/55">
            <span className="rounded-full bg-(--notion-hover) px-2.5 py-1">
              총 {items.length}개 항목
            </span>
            <span className="rounded-full bg-(--notion-hover) px-2.5 py-1">
              YouTube {youtubeSourceCount}
            </span>
            <span className="rounded-full bg-(--notion-hover) px-2.5 py-1">
              RSS {rssSourceCount}
            </span>
          </div>
        </div>

        <RefreshButton />
      </div>

      <FeedClientContainer initialItems={items} />

    </AppLayout>
  );
}
