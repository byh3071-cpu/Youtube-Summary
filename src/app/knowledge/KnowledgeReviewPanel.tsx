"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import {
  knowledgeCitationUrl,
  type KnowledgeClaimType,
  type KnowledgeJobStatus,
  type KnowledgeReviewDetail,
} from "@/lib/knowledge-capture";

const CLAIM_LABELS: Record<KnowledgeClaimType, string> = {
  fact: "사실 주장",
  interpretation: "해석",
  recommendation: "권고",
};

const COVERAGE_LABELS = {
  start: "도입부",
  middle: "중간",
  end: "마무리",
} as const;

function EvidenceLink({ sourceUrl, citation }: { sourceUrl?: string; citation?: string }) {
  const href = knowledgeCitationUrl(sourceUrl, citation);
  if (!href || !citation) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-(--border-subtle) px-3 text-xs font-semibold hover:bg-(--surface-subtle) focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {citation} 원본에서 확인 <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function EvidenceExcerpt({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <blockquote className="mt-3 border-l-2 border-(--border-subtle) pl-3 text-xs leading-5 text-(--text-secondary)">
      <span className="sr-only">검증에 사용한 짧은 원문: </span>
      “{children}”
    </blockquote>
  );
}

function ReviewRequestButton({ jobId, action }: { jobId: string; action: "approve" | "defer" }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const command = `knowledge ${action} ${jobId}`;
  const label = action === "approve" ? "승인 요청 복사" : "보류 요청 복사";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void copy()}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${
          action === "approve"
            ? "bg-(--notion-fg) text-(--notion-bg) hover:opacity-90"
            : "border border-(--border-subtle) hover:bg-(--surface-subtle)"
        }`}
      >
        <Copy size={15} aria-hidden="true" /> {copyState === "copied" ? "복사됨" : label}
      </button>
      {copyState === "failed" && (
        <p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          복사하지 못했어요. Codex에 <code className="break-all">{command}</code>를 입력해 주세요.
        </p>
      )}
    </div>
  );
}

export default function KnowledgeReviewPanel({
  review,
  sourceUrl,
  jobId,
  jobStatus,
}: {
  review: KnowledgeReviewDetail;
  sourceUrl?: string;
  jobId: string;
  jobStatus: KnowledgeJobStatus;
}) {
  const noUncertaintyFlagged = review.uncertainties.length === 0
    || review.uncertainties.every((item) => item === "없음");
  const hasEvidenceExcerpt = review.claims.some((claim) => Boolean(claim.evidenceExcerpt))
    || review.coverage.some((item) => Boolean(item.evidenceExcerpt));

  return (
    <div className="mt-4 border-t border-(--border-subtle) pt-4">
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <div className="rounded-xl bg-(--surface-subtle) px-4 py-3">
          <p className="text-xs font-semibold text-(--text-secondary)">자동 구조 검증</p>
          <p className="mt-1 text-xl font-bold tabular-nums">
            {review.qualityScore ?? "—"}<span className="text-xs font-medium text-(--text-secondary)">/100</span>
          </p>
        </div>
        <div className="rounded-xl border border-(--border-subtle) px-4 py-3 text-xs leading-relaxed text-(--text-secondary)">
          이 점수는 요약 구조, 영상 전 구간 커버리지, 원문과 타임스탬프의 정합성을 자동 검사한 결과예요.
          외부 세계의 사실 여부나 결론의 정확성을 보증하지 않습니다.
        </div>
      </div>

      {review.qualityWarnings.length > 0 && (
        <div className="mt-3 flex gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
          <ul className="space-y-1">
            {review.qualityWarnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}

      {!hasEvidenceExcerpt && review.claims.some((claim) => claim.type === "fact") && (
        <p className="mt-3 rounded-xl bg-(--surface-subtle) px-4 py-3 text-xs leading-5 text-(--text-secondary)">
          이전 처리 결과에는 짧은 원문 발췌가 없을 수 있어요. 아래 타임스탬프에서 원본을 확인해 주세요.
        </p>
      )}

      <section className="mt-5" aria-labelledby="review-summary-title">
        <p className="text-xs font-semibold text-(--text-secondary)">{review.category}</p>
        <h3 id="review-summary-title" className="mt-1 text-base font-bold">내용 요약</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{review.summary}</p>
      </section>

      {review.formatVersion === 2 && (
        <>
          {review.creatorThesis && (
            <section className="mt-5" aria-labelledby="review-creator-thesis-title">
              <h3 id="review-creator-thesis-title" className="text-sm font-bold">제작자의 주장과 영상 논리</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{review.creatorThesis}</p>
            </section>
          )}

          <section className="mt-5" aria-labelledby="review-audience-context-title">
            <h3 id="review-audience-context-title" className="text-sm font-bold">시청자 맥락</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-(--text-secondary)">
              {review.audienceContext ?? "댓글 미수집"}
            </p>
          </section>

          {review.criticalAnalysis && (
            <section className="mt-5 rounded-xl border border-(--border-subtle) px-4 py-4" aria-labelledby="review-critical-analysis-title">
              <h3 id="review-critical-analysis-title" className="text-sm font-bold">비판적 판단</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{review.criticalAnalysis}</p>
            </section>
          )}

          {review.ecosystemApplications.length > 0 && (
            <section className="mt-5" aria-labelledby="review-ecosystem-title">
              <h3 id="review-ecosystem-title" className="text-sm font-bold">요한 생태계 적용</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {review.ecosystemApplications.map((item) => (
                  <div key={`${item.area}-${item.application}`} className="rounded-xl bg-(--surface-subtle) px-4 py-3">
                    <p className="text-xs font-bold text-(--text-secondary)">{item.area}</p>
                    <p className="mt-1 text-sm leading-6">{item.application}</p>
                    {item.expectedEffect && <p className="mt-2 text-xs leading-5 text-(--text-secondary)">기대 효과: {item.expectedEffect}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {review.twoWeekExperiment && (
            <section className="mt-5 rounded-xl border border-(--border-subtle) px-4 py-4" aria-labelledby="review-experiment-title">
              <h3 id="review-experiment-title" className="text-sm font-bold">2주 실험</h3>
              <dl className="mt-3 grid gap-3 text-sm leading-6 sm:grid-cols-[6rem_1fr]">
                <dt className="font-semibold text-(--text-secondary)">가설</dt><dd>{review.twoWeekExperiment.hypothesis}</dd>
                <dt className="font-semibold text-(--text-secondary)">실행</dt><dd>{review.twoWeekExperiment.action}</dd>
                <dt className="font-semibold text-(--text-secondary)">지표</dt><dd>{review.twoWeekExperiment.metric}</dd>
                <dt className="font-semibold text-(--text-secondary)">중단 조건</dt><dd>{review.twoWeekExperiment.stopCondition}</dd>
              </dl>
            </section>
          )}
        </>
      )}

      {review.formatVersion !== 2 && review.keyPoints.length > 0 && (
        <section className="mt-5" aria-labelledby="review-points-title">
          <h3 id="review-points-title" className="text-sm font-bold">핵심 요점</h3>
          <ul className="mt-2 space-y-2">
            {review.keyPoints.map((point) => (
              <li key={point} className="flex gap-2 text-sm leading-6">
                <CheckCircle2 className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-400" size={15} aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.formatVersion !== 2 && review.claims.length > 0 && (
        <section className="mt-5" aria-labelledby="review-claims-title">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 id="review-claims-title" className="text-sm font-bold">주장과 확인 근거</h3>
            <p className="text-xs text-(--text-secondary)">사실 주장만 원문 시점과 연결합니다.</p>
          </div>
          <ol className="mt-2 space-y-2">
            {review.claims.map((claim, index) => (
              <li key={`${claim.type}-${index}`} className="rounded-xl border border-(--border-subtle) px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-(--surface-subtle) px-2.5 py-1 text-[11px] font-bold">
                    {CLAIM_LABELS[claim.type]}
                  </span>
                  {claim.type === "fact" && claim.citationVerified && (
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">원문 위치 확인됨</span>
                  )}
                  {(claim.type !== "fact" || claim.requiresCrosscheck) && (
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">별도 판단 필요</span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6">{claim.statement}</p>
                <EvidenceExcerpt>{claim.evidenceExcerpt}</EvidenceExcerpt>
                {claim.type === "fact" && (
                  <div className="mt-3">
                    <EvidenceLink sourceUrl={sourceUrl} citation={claim.citation} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {review.formatVersion !== 2 && review.coverage.length > 0 && (
        <section className="mt-5" aria-labelledby="review-coverage-title">
          <h3 id="review-coverage-title" className="text-sm font-bold">영상 전 구간 확인</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {review.coverage.map((item) => (
              <div key={item.part} className="rounded-xl bg-(--surface-subtle) px-4 py-3">
                <p className="text-xs font-bold text-(--text-secondary)">{COVERAGE_LABELS[item.part]}</p>
                <p className="mt-1 text-sm leading-6">{item.statement}</p>
                <EvidenceExcerpt>{item.evidenceExcerpt}</EvidenceExcerpt>
                <div className="mt-2">
                  <EvidenceLink sourceUrl={sourceUrl} citation={item.citation} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {review.formatVersion !== 2 && review.relevance && (
        <section className="mt-5 rounded-xl border border-(--border-subtle) px-4 py-3" aria-labelledby="review-relevance-title">
          <h3 id="review-relevance-title" className="text-sm font-bold">AI가 제안한 적재 이유</h3>
          <p className="mt-2 text-sm leading-6">{review.relevance}</p>
        </section>
      )}

      {review.formatVersion !== 2 && <section className="mt-5" aria-labelledby="review-uncertainty-title">
        <h3 id="review-uncertainty-title" className="text-sm font-bold">불확실성</h3>
        {noUncertaintyFlagged ? (
          <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
            모델이 별도 불확실성을 표시하지 않았습니다. 이는 불확실성이 실제로 없다는 뜻이 아니에요.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
            {review.uncertainties.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </section>}

      {review.formatVersion === 2 && (
        <section className="mt-6 border-t border-(--border-subtle) pt-5" aria-labelledby="review-evidence-appendix-title">
          <h3 id="review-evidence-appendix-title" className="text-sm font-bold">검증 부록</h3>
          <p className="mt-1 text-xs leading-5 text-(--text-secondary)">본문 흐름을 방해하지 않도록 타임스탬프와 불확실성을 이곳에 모았습니다.</p>
          <ol className="mt-3 space-y-2">
            {review.evidenceMap.map((item) => (
              <li key={item.claimId} className="rounded-xl bg-(--surface-subtle) px-4 py-3">
                <p className="text-xs font-bold text-(--text-secondary)">{item.claimId}</p>
                <p className="mt-1 text-sm leading-6">{item.statement}</p>
                {item.note && <p className="mt-1 text-xs leading-5 text-(--text-secondary)">{item.note}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.timestamps.map((timestamp) => (
                    <EvidenceLink key={timestamp} sourceUrl={sourceUrl} citation={timestamp} />
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <h4 className="mt-4 text-xs font-bold text-(--text-secondary)">불확실성·교차검증</h4>
          {noUncertaintyFlagged ? (
            <p className="mt-2 text-sm text-(--text-secondary)">별도로 표시된 불확실성이 없습니다.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
              {review.uncertainties.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </section>
      )}

      <a
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-(--border-subtle) px-4 text-sm font-semibold hover:bg-(--surface-subtle) focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        원본 영상 전체 보기 <ExternalLink size={15} aria-hidden="true" />
      </a>

      <section className="mt-5 rounded-2xl border border-(--border-subtle) bg-(--surface-subtle) px-4 py-4" aria-labelledby="review-next-step-title">
        <h3 id="review-next-step-title" className="text-sm font-bold">검토를 마쳤다면</h3>
        {jobStatus === "approving" ? (
          <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
            승인 요청을 처리하고 있어요. Yohan Brain 기록이 끝나면 상태가 완료로 바뀝니다.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
              아래 요청을 복사해 집의 Codex 채팅에 붙여넣으세요. 승인하기 전에는 Yohan Brain에 기록되지 않습니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ReviewRequestButton jobId={jobId} action="approve" />
              <ReviewRequestButton jobId={jobId} action="defer" />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
