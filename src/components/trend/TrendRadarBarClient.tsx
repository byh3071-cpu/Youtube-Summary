"use client";

import { useKeywordFilter } from "@/components/feed/KeywordFilter";
import type { TrendRadarItem } from "@/app/actions/trend";

interface Props {
  trends: TrendRadarItem[];
  generatedAt: string;
}

export default function TrendRadarBarClient({ trends, generatedAt }: Props) {
  const { addKeyword } = useKeywordFilter();
  const top = trends.slice(0, 5);

  return (
    <section className="mb-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-3 sm:px-5 sm:py-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-(--notion-fg)/55">
            지능형 트렌드 레이더
          </p>
          <p className="text-[11px] text-(--notion-fg)/55">
            최근 24시간 유튜브·RSS에서 감지한 키워드예요. 클릭하면 필터에 추가됩니다.
          </p>
        </div>
        <p className="hidden text-[11px] text-(--notion-fg)/45 sm:block">
          {new Date(generatedAt).toLocaleTimeString("ko-KR", {
            hour: "numeric",
            minute: "2-digit",
          })}
          기준
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {top.map((trend) => (
          <button
            key={trend.keyword}
            type="button"
            onClick={() => addKeyword(trend.keyword)}
            className="inline-flex items-center gap-1 rounded-full bg-(--notion-gray)/40 px-3 py-1 text-xs font-semibold text-(--notion-fg)/80 hover:bg-(--notion-gray)"
            aria-label={`${trend.keyword} 트렌드 필터에 추가`}
          >
            <span className="text-[10px] text-(--notion-fg)/60">#{Math.round(trend.score)}</span>
            <span>{trend.keyword}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

