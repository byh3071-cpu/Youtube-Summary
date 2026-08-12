"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  knowledgeJobActionMessage,
  knowledgeJobStatusLabel,
  type KnowledgeJobStatus,
  type KnowledgeJobSummary,
  type KnowledgeReviewDetail,
} from "@/lib/knowledge-capture";
import KnowledgeReviewPanel from "./KnowledgeReviewPanel";

type QueueSection = "needs_action" | "active" | "completed";

const SECTION_META: Record<QueueSection, { label: string; description: string }> = {
  needs_action: { label: "확인 필요", description: "검토하거나 조치할 항목" },
  active: { label: "처리 중", description: "대기 중이거나 처리 중인 항목" },
  completed: { label: "완료", description: "Brain 적재까지 끝난 항목" },
};

function sectionForStatus(status: KnowledgeJobStatus): QueueSection {
  if (status === "review_required" || status === "action_required" || status === "failed") return "needs_action";
  if (status === "completed" || status === "cancelled") return "completed";
  return "active";
}

function StatusIcon({ status }: { status: KnowledgeJobStatus }) {
  const section = sectionForStatus(status);
  if (section === "needs_action") return <AlertCircle size={14} aria-hidden="true" />;
  if (section === "completed") return <CheckCircle2 size={14} aria-hidden="true" />;
  return <Clock3 size={14} aria-hidden="true" />;
}

export default function KnowledgeQueueClient() {
  const router = useRouter();
  const [jobs, setJobs] = useState<KnowledgeJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [activeSection, setActiveSection] = useState<QueueSection>("needs_action");
  const initialSectionSelected = useRef(false);
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
      if (!jobsResponse.ok) throw new Error(jobsData?.error ?? "지식함을 불러오지 못했어요.");
      setJobs(jobsData?.jobs ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "지식함을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groupedJobs = useMemo(() => ({
    needs_action: jobs.filter((job) => sectionForStatus(job.status) === "needs_action"),
    active: jobs.filter((job) => sectionForStatus(job.status) === "active"),
    completed: jobs.filter((job) => sectionForStatus(job.status) === "completed"),
  }), [jobs]);

  useEffect(() => {
    if (loading || initialSectionSelected.current) return;
    initialSectionSelected.current = true;
    if (jobs.length === 0 || groupedJobs[activeSection].length > 0) return;
    const nextSection = (["needs_action", "active", "completed"] as QueueSection[])
      .find((section) => groupedJobs[section].length > 0);
    if (nextSection) setActiveSection(nextSection);
  }, [activeSection, groupedJobs, jobs.length, loading]);

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

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

  const visibleJobs = groupedJobs[activeSection];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-8">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="이전 화면으로 돌아가기"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-(--border-subtle) bg-(--surface-raised) hover:bg-(--surface-subtle) focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold sm:text-2xl">지식함</h1>
          <p className="mt-0.5 truncate text-sm text-(--text-secondary)">담은 영상의 처리와 검토 상태</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="지식함 새로고침"
          className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-(--border-subtle) bg-(--surface-raised) px-3 text-sm font-semibold hover:bg-(--surface-subtle) disabled:opacity-60"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          <span className="hidden sm:inline">새로고침</span>
        </button>
      </header>

      {!authRequired && !error && !loading && jobs.length > 0 && (
        <nav aria-label="지식함 상태" className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-(--surface-subtle) p-1">
          {(Object.keys(SECTION_META) as QueueSection[]).map((section) => {
            const selected = activeSection === section;
            return (
              <button
                key={section}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setActiveSection(section);
                  setExpandedJobId(null);
                }}
                className={`min-h-11 rounded-xl px-2 text-sm font-semibold transition-colors ${selected
                  ? "bg-(--surface-raised) text-(--text-primary) shadow-[var(--shadow-xs)]"
                  : "text-(--text-secondary) hover:text-(--text-primary)"}`}
              >
                {SECTION_META[section].label}
                <span className="ml-1 tabular-nums" aria-label={`${groupedJobs[section].length}개`}>
                  {groupedJobs[section].length}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      <section className="mt-4">
        {authRequired ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-(--border-subtle) bg-(--surface-raised) px-5 text-center">
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
          <div role="status" className="flex min-h-40 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 px-5 text-center text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-(--border-subtle) bg-(--surface-raised) text-sm text-(--text-secondary)">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />불러오는 중
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-(--border-subtle) bg-(--surface-raised) px-5 text-center">
            <Brain size={28} aria-hidden="true" />
            <div>
              <p className="font-semibold">아직 담은 영상이 없어요.</p>
              <p className="mt-1 text-sm text-(--text-secondary)">유용한 영상을 발견하면 한 번에 담아두세요.</p>
            </div>
            <Link href="/capture" className="inline-flex min-h-11 items-center rounded-xl bg-(--notion-fg) px-4 text-sm font-semibold text-(--notion-bg) hover:opacity-90">
              영상 담기
            </Link>
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-(--border-subtle) px-5 text-center">
            <CheckCircle2 size={24} aria-hidden="true" />
            <p className="mt-2 font-semibold">{SECTION_META[activeSection].label} 항목이 없어요.</p>
            <p className="mt-1 text-sm text-(--text-secondary)">{SECTION_META[activeSection].description}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleJobs.map((job) => {
              const actionMessage = knowledgeJobActionMessage(job);
              const expanded = expandedJobId === job.id;
              const sourceUrl = job.sourceUrl ?? `https://www.youtube.com/watch?v=${job.videoId}`;
              const review = reviews[job.id] ?? job.review;
              const reviewAvailable = job.reviewAvailable || Boolean(review);
              const section = sectionForStatus(job.status);

              return (
                <li key={job.id} className="overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--surface-raised) shadow-[var(--shadow-xs)]">
                  <article className="px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${section === "needs_action"
                        ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                        : section === "completed"
                          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                          : "bg-(--playback-accent-muted) text-(--playback-accent)"}`}
                      >
                        <StatusIcon status={job.status} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-(--text-secondary)">{knowledgeJobStatusLabel(job.status)}</span>
                          <span className="text-xs text-(--text-secondary)" aria-hidden="true">·</span>
                          <time className="text-xs text-(--text-secondary)" dateTime={job.createdAt}>
                            {new Date(job.createdAt).toLocaleDateString("ko-KR")}
                          </time>
                        </div>
                        <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block text-base font-semibold leading-6 hover:underline">
                          {job.title ?? `YouTube ${job.videoId}`}
                        </a>
                        {job.channelName && <p className="mt-1 truncate text-sm text-(--text-secondary)">{job.channelName}</p>}
                        {actionMessage && (
                          <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm leading-6 text-amber-800 dark:text-amber-200">{actionMessage}</p>
                        )}
                      </div>
                    </div>

                    {reviewAvailable && (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`knowledge-review-${job.id}`}
                        onClick={() => toggleReview(job)}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-(--border-subtle) px-4 text-sm font-semibold hover:bg-(--surface-subtle) focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto sm:gap-3"
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
                        <button type="button" onClick={() => void openReview(job)} className="mt-2 min-h-11 rounded-lg border border-current px-3 text-xs font-semibold">
                          다시 불러오기
                        </button>
                      </div>
                    )}

                    {review && expanded && (
                      <div id={`knowledge-review-${job.id}`}>
                        <KnowledgeReviewPanel review={review} sourceUrl={sourceUrl} jobId={job.id} jobStatus={job.status} />
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
