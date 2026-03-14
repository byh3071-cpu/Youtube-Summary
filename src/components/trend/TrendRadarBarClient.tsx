"use client";

import type { TrendRadarItem } from "@/app/actions/trend";
import { useTrendFilter } from "@/contexts/TrendFilterContext";

interface Props {
  trends: TrendRadarItem[];
  generatedAt: string;
  /** 소스 선택 시 헤더 카드에 붙여서 하나의 블록처럼 표시 */
  attachToHeader?: boolean;
}

export default function TrendRadarBarClient({ trends, generatedAt, attachToHeader }: Props) {
  const trendFilter = useTrendFilter();
  const selectedTrendKeyword = trendFilter?.selectedTrendKeyword ?? null;
  const toggleTrendKeyword = trendFilter?.toggleTrendKeyword ?? (() => {});
  const setSelectedTrendKeyword = trendFilter?.setSelectedTrendKeyword ?? (() => {});

  // 점수 순으로 정렬 후 상위 10개 = 1위~10위
  const top = [...trends].sort((a, b) => b.score - a.score).slice(0, 10);

  return (
    <section className={attachToHeader ? "rounded-b-2xl border border-t-0 border-(--notion-border) bg-(--notion-bg) px-4 py-3 sm:px-5 sm:py-3.5" : "mb-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-3 sm:px-5 sm:py-3.5"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-(--notion-fg)/55">
            요즘 뜨는 키워드
          </p>
          <p className="text-[11px] text-(--notion-fg)/55">
            클릭하면 관련 영상·RSS만 보여요. 다시 클릭하거나 전체를 누르면 전체 피드로 돌아갑니다.
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
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {selectedTrendKeyword && (
          <button
            type="button"
            onClick={() => setSelectedTrendKeyword(null)}
            className="inline-flex items-center gap-1 rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1 text-xs font-semibold text-(--notion-fg)/80 hover:bg-(--notion-hover)"
            aria-label="전체 피드로 보기"
          >
            전체
          </button>
        )}
        {top.map((trend, index) => {
          const isSelected = selectedTrendKeyword === trend.keyword;
          return (
            <button
              key={trend.keyword}
              type="button"
              onClick={() => toggleTrendKeyword(trend.keyword)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                isSelected
                  ? "bg-(--focus-accent) text-black"
                  : "bg-(--notion-gray)/40 text-(--notion-fg)/80 hover:bg-(--notion-gray)"
              }`}
              aria-label={isSelected ? `${trend.keyword} 선택 해제` : `${trend.keyword} 관련만 보기`}
            >
              <span className="text-[10px] opacity-80">{index + 1}위</span>
              <span>{trend.keyword}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

