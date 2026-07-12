import { getTrendRadar } from "@/app/actions/trend";
import TrendRadarBarClient from "./TrendRadarBarClient";

interface Props {
  /** 소스 선택 시 헤더 카드에 붙여서 표시 */
  attachToHeader?: boolean;
  /** 글로벌 검색 패널 안에 들어갈 때 외곽 카드 스타일 제거 */
  integratedWithSearch?: boolean;
}

export default async function TrendRadarBar({ attachToHeader, integratedWithSearch }: Props = {}) {
  const result = await getTrendRadar(false);

  if (!result || !result.trends || result.trends.length === 0) {
    return (
      <section className={integratedWithSearch ? "bg-(--notion-bg) px-3 pb-3 pt-1 text-[11px] text-(--notion-fg)/55 sm:px-4" : attachToHeader ? "rounded-b-2xl border border-t-0 border-dashed border-(--notion-border) bg-(--notion-bg) px-4 py-3 text-[11px] text-(--notion-fg)/55 sm:px-5" : "mb-4 rounded-2xl border border-dashed border-(--notion-border) bg-(--notion-bg) px-4 py-3 text-[11px] text-(--notion-fg)/55 sm:px-5"}>
        <p className="font-semibold uppercase tracking-wide text-(--notion-fg)/55">
          요즘 뜨는 키워드
        </p>
        <p className="mt-1">
          최근 24시간 동안 분석할 피드가 없거나, AI 분석에 잠시 실패해서 트렌드를 보여줄 수 없어요.
        </p>
      </section>
    );
  }

  return <TrendRadarBarClient trends={result.trends} generatedAt={result.generatedAt} attachToHeader={attachToHeader} integratedWithSearch={integratedWithSearch} />;
}

