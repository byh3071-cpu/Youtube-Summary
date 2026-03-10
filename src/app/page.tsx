import AppLayout from "@/components/layout/AppLayout";
import FeedClientContainer from "@/components/feed/FeedClientContainer";
import RefreshButton from "@/components/ui/RefreshButton";
import { getMergedFeed } from "@/lib/feed";
import { defaultSources, getSourceById } from "@/lib/sources";

export const revalidate = 7200; // 2 hours

interface HomeProps {
  searchParams?: Promise<{
    source?: string;
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const selectedSourceId = resolvedSearchParams?.source;
  const selectedSource = getSourceById(selectedSourceId);

  // 서버 컴포넌트에서 데이터 페치 (getMergedFeed에 의해 캐시 적용됨)
  const { items, sourceStatus } = await getMergedFeed();
  const visibleItems = selectedSource
    ? items.filter((item) => item.sourceId === selectedSource.id)
    : items;
  const youtubeSourceCount = defaultSources.filter((source) => source.type === "YouTube").length;
  const rssSourceCount = defaultSources.filter((source) => source.type === "RSS").length;
  const youtubeStatusLabel = {
    ready: "YouTube 연결됨",
    missing_api_key: "YouTube 키 필요",
    invalid_api_key: "YouTube 키 오류",
    request_failed: "YouTube 일시 장애",
  } as const;
  const youtubeStatusTone = {
    ready: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    missing_api_key: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    invalid_api_key: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    request_failed: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  } as const;
  const showYoutubeNotice = sourceStatus.youtube !== "ready" && (!selectedSource || selectedSource.type === "YouTube");
  const visibleSourceSummary = selectedSource
    ? `${selectedSource.name} 소스만 따로 보고 있습니다.`
    : showYoutubeNotice
      ? "현재 RSS 소스만 피드에 반영되고 있습니다."
      : "현재 YouTube와 RSS 소스가 모두 피드에 반영되고 있습니다.";
  const youtubeNoticeMessage = {
    missing_api_key: selectedSource
      ? `현재 ${selectedSource.name} 채널을 불러오려면 YouTube API 키가 필요합니다.`
      : "현재 YouTube API 키가 설정되지 않아 RSS 소스만 표시하고 있습니다.",
    invalid_api_key: selectedSource
      ? `현재 ${selectedSource.name} 채널을 불러올 수 없습니다. \`.env.local\`의 \`YOUTUBE_API_KEY\`를 확인해 주세요.`
      : "현재 YouTube API 키가 유효하지 않아 RSS 소스만 표시하고 있습니다. `.env.local`의 `YOUTUBE_API_KEY`를 확인해 주세요.",
    request_failed: selectedSource
      ? `현재 ${selectedSource.name} 채널을 불러오지 못하고 있습니다. 잠시 후 다시 시도해 주세요.`
      : "현재 YouTube 소스를 불러오지 못해 RSS 소스만 먼저 표시하고 있습니다. 잠시 후 다시 시도해 주세요.",
    ready: "",
  } as const;

  return (
    <AppLayout sourceStatus={sourceStatus} selectedSourceId={selectedSource?.id}>
      <section className="mb-6 rounded-3xl border border-(--notion-border) bg-linear-to-b from-(--notion-bg) to-(--notion-gray) p-4 sm:mb-8 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex rounded-full border border-(--notion-border) bg-(--notion-bg) px-2.5 py-1 text-[11px] font-semibold tracking-wide text-(--notion-fg)/55 uppercase">
              {selectedSource ? "Source View" : "Daily Digest"}
            </span>
            <h1 className="mb-2 mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {selectedSource ? selectedSource.name : "Focus Feed"}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-(--notion-fg)/60 sm:text-base">
            {selectedSource
              ? `${selectedSource.type} 소스에서 가져온 항목만 모아 보고 있습니다.`
              : "알고리즘 없이 텍스트 중심의 정제된 정보를 큐레이션 합니다."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-(--notion-fg)/55 sm:flex sm:flex-wrap">
              <span className="rounded-2xl border border-(--notion-border) bg-(--notion-bg)/70 px-3 py-2">
                총 {visibleItems.length}개 항목
              </span>
              <span className={`rounded-2xl border px-3 py-2 ${youtubeStatusTone[sourceStatus.youtube]}`}>
                {youtubeStatusLabel[sourceStatus.youtube]}
              </span>
              <span className="rounded-2xl border border-(--notion-border) bg-(--notion-bg)/70 px-3 py-2">
                YouTube {youtubeSourceCount}
              </span>
              <span className="rounded-2xl border border-(--notion-border) bg-(--notion-bg)/70 px-3 py-2">
                RSS {rssSourceCount}
              </span>
              <span className="rounded-2xl border border-(--notion-border) bg-(--notion-bg)/70 px-3 py-2">
                2시간 단위 갱신
              </span>
              {selectedSource && (
                <span className="rounded-2xl border border-(--notion-border) bg-(--notion-bg)/70 px-3 py-2">
                  개별 소스 보기
                </span>
              )}
            </div>
          </div>

          <RefreshButton />
        </div>

        {showYoutubeNotice && (
          <div className="mt-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg)/70 px-4 py-3 text-sm leading-relaxed text-(--notion-fg)/65">
            {youtubeNoticeMessage[sourceStatus.youtube]}
          </div>
        )}
      </section>

      <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold">현재 표시 중인 소스</p>
          <p className="text-sm leading-relaxed text-(--notion-fg)/55">
            {visibleSourceSummary}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full border px-3 py-1.5 ${youtubeStatusTone[sourceStatus.youtube]}`}>
            {youtubeStatusLabel[sourceStatus.youtube]}
          </span>
          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-blue-700 dark:text-blue-300">
            RSS 정상
          </span>
        </div>
      </section>

      <FeedClientContainer initialItems={visibleItems} selectedSourceName={selectedSource?.name} />

    </AppLayout>
  );
}
