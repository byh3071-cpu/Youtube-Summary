import { getTrendRadar } from "@/app/actions/trend";
import TrendRadarBarClient from "./TrendRadarBarClient";

export default async function TrendRadarBar() {
  const result = await getTrendRadar(false);

  if (!result || !result.trends || result.trends.length === 0) {
    return (
      <section className="mb-4 rounded-2xl border border-dashed border-(--notion-border) bg-(--notion-bg) px-4 py-3 text-[11px] text-(--notion-fg)/55 sm:px-5">
        <p className="font-semibold uppercase tracking-wide text-(--notion-fg)/55">
          지능형 트렌드 레이더
        </p>
        <p className="mt-1">
          최근 24시간 동안 분석할 피드가 없거나, AI 분석에 잠시 실패해서 트렌드를 보여줄 수 없어요.
        </p>
      </section>
    );
  }

  return <TrendRadarBarClient trends={result.trends} generatedAt={result.generatedAt} />;
}

