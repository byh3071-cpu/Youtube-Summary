"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Brain, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import {
  knowledgeJobActionMessage,
  knowledgeJobStatusLabel,
  type KnowledgeJobSummary,
  type KnowledgeReviewDetail,
} from "@/lib/knowledge-capture";
import KnowledgeReviewPanel from "./KnowledgeReviewPanel";

export default function KnowledgeQueueClient() {
  const [jobs, setJobs] = useState<KnowledgeJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, KnowledgeReviewDetail>>({});
  const [reviewLoadingJobId, setReviewLoadingJobId] = useState<string | null>(null);
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    try {
      const jobsResponse = await fetch("/api/knowledge/jobs", { cache: "no-store" });
      const jobsData = await jobsResponse.json().catch(() => null) as {
        jobs?: KnowledgeJobSummary[];
        error?: string;
      } | null;
      if (jobsResponse.status === 401) {
        setAuthRequired(true);
        setJobs([]);
        return;
      }
      if (!jobsResponse.ok) throw new Error(jobsData?.error ?? "지식 대기열을 불러오지 못했어요.");
      setJobs(jobsData?.jobs ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "지식 대기열을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openReview = useCallback(async (job: KnowledgeJobSummary) => {
    setExpandedJobId(job.id);
    if (reviews[job.id] ?? job.review) return;

    setReviewLoadingJobId(job.id);
    setReviewErrors((current) => ({ ...current, [job.id]: "" }));
    try {
      const response = await fetch(`/api/knowledge/jobs/${encodeURIComponent(job.id)}/review`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as { review?: KnowledgeReviewDetail; error?: string } | null;
      if (!response.ok || !data?.review) throw new Error(data?.error ?? "검토 내용을 불러오지 못했어요.");
      setReviews((current) => ({ ...current, [job.id]: data.review! }));
    } catch (cause) {
      setReviewErrors((current) => ({
        ...current,
        [job.id]: cause instanceof Error ? cause.message : "검토 내용을 불러오지 못했어요.",
      }));
    } finally {
      setReviewLoadingJobId((current) => current === job.id ? null : current);
    }
  }, [reviews]);

  const toggleReview = useCallback((job: KnowledgeJobSummary) => {
    if (expandedJobId === job.id) {
      setExpandedJobId(null);
      return;
    }
    void openReview(job);
  }, [expandedJobId, openReview]);

  return (
    <main className="mx-auto max-w-3xl px-1 py-4 sm:px-4 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">지식 대기열</h1>
          <p className="mt-1 text-sm text-(--text-secondary)">담은 영상의 처리 상태와 승인 근거를 확인하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-(--border-subtle) px-3 text-sm font-semibold hover:bg-(--surface-subtle) disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          새로고침
        </button>
      </div>

      <section className="mt-5 rounded-2xl border border-(--border-subtle) bg-(--surface-raised)">
        {authRequired ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-5 text-center">
            <Brain size={28} aria-hidden="true" />
            <div>
              <p className="font-semibold">로그인하면 검토 내용을 볼 수 있어요.</p>
              <p className="mt-1 text-sm text-(--text-secondary)">요약과 타임스탬프 근거는 본인에게만 표시됩니다.</p>
            </div>
            <Link href="/login?next=/knowledge" className="inline-flex min-h-11 items-center rounded-xl border border-(--border-subtle) px-4 text-sm font-semibold hover:bg-(--surface-subtle)">
              로그인하기
            </Link>
          </div>
        ) : error ? (
          <div role="status" className="flex min-h-40 items-center justify-center px-5 text-center text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-(--text-secondary)">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />불러오는 중
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-5 text-center">
            <Brain size={28} aria-hidden="true" />
            <p className="font-semibold">아직 담은 영상이 없어요.</p>
            <Link href="/capture" className="inline-flex min-h-11 items-center rounded-xl border border-(--border-subtle) px-4 text-sm font-semibold hover:bg-(--surface-subtle)">
              영상 담기
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-(--border-subtle)">
            {jobs.map((job) => {
              const actionMessage = knowledgeJobActionMessage(job);
              const expanded = expandedJobId === job.id;
              const sourceUrl = job.sourceUrl ?? `https://www.youtube.com/watch?v=${job.videoId}`;
              const review = reviews[job.id] ?? job.review;
              const reviewAvailable = job.reviewAvailable || Boolean(review);

              return (
                <li key={job.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <a href={sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold hover:underline">
                        {job.title ?? `YouTube ${job.videoId}`}
                      </a>
                      <p className="mt-1 truncate text-xs text-(--text-secondary)">
                        {job.channelName ? `${job.channelName} · ` : ""}{new Date(job.createdAt).toLocaleString("ko-KR")}
                      </p>
                      {actionMessage && (
                        <p className="mt-2 max-w-xl text-xs leading-relaxed text-amber-700 dark:text-amber-300">{actionMessage}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-(--surface-subtle) px-3 py-1.5 text-xs font-semibold">
                      {knowledgeJobStatusLabel(job.status)}
                    </span>
                  </div>

                  {reviewAvailable && (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`knowledge-review-${job.id}`}
                      onClick={() => toggleReview(job)}
                      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-(--border-subtle) px-4 text-sm font-semibold hover:bg-(--surface-subtle) focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {expanded ? "검토 내용 닫기" : "요약과 근거 확인"}
                      <ChevronDown size={16} className={expanded ? "rotate-180" : ""} aria-hidden="true" />
                    </button>
                  )}

                  {expanded && reviewLoadingJobId === job.id && (
                    <div role="status" className="mt-3 flex min-h-20 items-center gap-2 text-sm text-(--text-secondary)">
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" /> 검토 내용을 불러오는 중
                    </div>
                  )}

                  {expanded && reviewErrors[job.id] && reviewLoadingJobId !== job.id && (
                    <div role="alert" className="mt-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                      <p>{reviewErrors[job.id]}</p>
                      <button
                        type="button"
                        onClick={() => void openReview(job)}
                        className="mt-2 min-h-11 rounded-lg border border-current px-3 text-xs font-semibold"
                      >
                        다시 불러오기
                      </button>
                    </div>
                  )}

                  {review && expanded && (
                    <div id={`knowledge-review-${job.id}`}>
                      <KnowledgeReviewPanel
                        review={review}
                        sourceUrl={sourceUrl}
                        jobId={job.id}
                        jobStatus={job.status}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
