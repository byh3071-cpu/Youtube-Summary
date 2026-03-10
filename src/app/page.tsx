import AppLayout from "@/components/layout/AppLayout";
import FeedClientContainer from "@/components/feed/FeedClientContainer";
import RefreshButton from "@/components/ui/RefreshButton";
import { getMergedFeed } from "@/lib/feed";

export const revalidate = 7200; // 2 hours

export default async function Home() {
  // 서버 컴포넌트에서 데이터 페치 (getMergedFeed에 의해 캐시 적용됨)
  const items = await getMergedFeed();

  return (
    <AppLayout>
      <div className="pb-8 border-b border-(--notion-border) mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Focus Feed</h1>
          <p className="text-(--notion-fg)/60">
            알고리즘 없이 텍스트 중심의 정제된 정보를 큐레이션 합니다.
          </p>
        </div>

        <RefreshButton />
      </div>

      <FeedClientContainer initialItems={items} />

    </AppLayout>
  );
}
