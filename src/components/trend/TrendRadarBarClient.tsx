"use client";

import type { TrendRadarItem } from "@/app/actions/trend";
import { useTrendFilter } from "@/contexts/TrendFilterContext";

interface Props {
  trends: TrendRadarItem[];
  generatedAt: string;
  /** 소스 선택 시 헤더 카드에 붙여서 하나의 블록처럼 표시 */
  attachToHeader?: boolean;
  /** 글로벌 검색 패널 안에 들어갈 때 외곽 카드 스타일 제거 */
  integratedWithSearch?: boolean;
}

export default function TrendRadarBarClient({ trends, generatedAt, attachToHeader, integratedWithSearch }: Props) {
  const trendFilter = useTrendFilter();
  const selectedTrendKeyword = trendFilter?.selectedTrendKeyword ?? null;
  const toggleTrendKeyword = trendFilter?.toggleTrendKeyword ?? (() => {});
  const setSelectedTrendKeyword = trendFilter?.setSelectedTrendKeyword ?? (() => {});

  // 점수 순으로 정렬 후 상위 10개 = 1위~10위
  const top = [...trends].sort((a, b) => b.score - a.score).slice(0, 10);

  return (
    <section className={integratedWithSearch ? "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 py-1" : attachToHeader ? "rounded-b-2xl border border-t-0 border-(--notion-border) bg-(--notion-bg) px-4 py-2.5 sm:px-5" : "mb-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-2.5 sm:px-5"}>
      <div className={integratedWithSearch ? "flex items-center gap-1" : "mb-1.5 flex items-center justify-between gap-2"}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-(--text-secondary)">
          {integratedWithSearch ? "🔥 트렌드" : "🔥 요즘 뜨는 키워드"}
        </p>
        {selectedTrendKeyword ? (
          <button
            type="button"
            onClick={() => setSelectedTrendKeyword(null)}
            className="shrink-0 rounded-full border border-(--notion-border) px-2.5 py-0.5 text-[11px] font-semibold text-(--notion-fg)/70 hover:bg-(--notion-hover)"
            aria-label="전체 피드로 보기"
          >
            전체 보기
          </button>
        ) : (
          <p className={`${integratedWithSearch ? "hidden" : "hidden sm:block"} shrink-0 text-[11px] text-(--text-secondary)`}>
            {new Date(generatedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}기준
          </p>
        )}
      </div>
      {/* 칩은 한 줄 가로 스크롤로 — 모바일 상단 높이 절약 */}
      <div className={integratedWithSearch ? "flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:-mx-5 sm:px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
        {top.map((trend, index) => {
          const isSelected = selectedTrendKeyword === trend.keyword;
          return (
            <button
              key={trend.keyword}
              type="button"
              onClick={() => toggleTrendKeyword(trend.keyword, trend.sampleTitles ?? [])}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-accent)/60 ${
                isSelected
                  ? "bg-(--focus-accent) text-black"
                  : "bg-(--notion-gray)/40 text-(--notion-fg)/80 hover:bg-(--notion-gray)"
              }`}
              aria-label={isSelected ? `${trend.keyword} 선택 해제` : `${trend.keyword} 관련만 보기`}
            >
              <span className="text-[10px]">{index + 1}</span>
              <span>{trend.keyword}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

