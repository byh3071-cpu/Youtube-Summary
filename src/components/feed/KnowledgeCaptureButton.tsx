"use client";

import { useState } from "react";
import { Brain, Check, CircleAlert, Loader2, XCircle } from "lucide-react";
import {
  knowledgeJobStatusLabel,
  notifyKnowledgeJobsChanged,
  type KnowledgeJobSummary,
} from "@/lib/knowledge-capture";

type CaptureState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "done"; job: KnowledgeJobSummary }
  | { kind: "error"; message: string; job?: KnowledgeJobSummary };

interface Props {
  videoUrl: string;
  title?: string;
  channelName?: string;
  compact?: boolean;
  className?: string;
  job?: KnowledgeJobSummary | null;
  onJobChange?: (job: KnowledgeJobSummary) => void;
}

export default function KnowledgeCaptureButton({
  videoUrl,
  title,
  channelName,
  compact = false,
  className = "",
  job = null,
  onJobChange,
}: Props) {
  const [state, setState] = useState<CaptureState>({ kind: "idle" });
  // 서버에서 다시 읽은 상태가 POST 직후의 로컬 상태보다 항상 최신이다.
  const currentJob = job ?? (state.kind === "done" || state.kind === "error" ? state.job ?? null : null);

  const capture = async () => {
    if (state.kind === "submitting") return;
    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/knowledge/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: videoUrl,
          title,
          channelName,
          via: "focus-feed",
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { created?: boolean; job?: KnowledgeJobSummary; error?: string }
        | null;
      if (!response.ok) {
        if (data?.job) {
          onJobChange?.(data.job);
          notifyKnowledgeJobsChanged();
        }
        setState({
          kind: "error",
          message: data?.error ?? "지식 대기열 접수에 실패했습니다.",
          job: data?.job,
        });
        return;
      }
      if (!data?.job) {
        setState({ kind: "error", message: "지식 대기열 응답을 확인하지 못했습니다." });
        return;
      }
      setState({ kind: "done", job: data.job });
      onJobChange?.(data.job);
      notifyKnowledgeJobsChanged();
    } catch {
      setState({ kind: "error", message: "연결 오류입니다. 잠시 후 다시 시도해 주세요." });
    }
  };

  const label = currentJob ? knowledgeJobStatusLabel(currentJob.status) : "지식으로 담기";
  const displayLabel = currentJob && !currentJob.captureReady ? "처리 준비 다시 시도" : label;
  const isDone = Boolean(currentJob?.captureReady);
  const isSubmitting = state.kind === "submitting";
  const iconSize = compact ? 16 : 17;

  const statusIcon = isSubmitting || currentJob?.status === "processing" || currentJob?.status === "approving"
    ? <Loader2 size={iconSize} className="animate-spin" aria-hidden />
    : currentJob && !currentJob.captureReady
      ? <CircleAlert size={iconSize} aria-hidden />
    : currentJob?.status === "failed" || currentJob?.status === "cancelled"
      ? <XCircle size={iconSize} aria-hidden />
      : currentJob?.status === "review_required" || currentJob?.status === "action_required"
        ? <CircleAlert size={iconSize} aria-hidden />
        : currentJob
          ? <Check size={iconSize} aria-hidden />
          : <Brain size={iconSize} aria-hidden />;

  return (
    <span className={`inline-flex min-w-0 flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={capture}
        disabled={isSubmitting || isDone}
        className={compact
          ? "inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-2 font-semibold text-(--text-primary) hover:bg-(--surface-subtle) disabled:cursor-default disabled:opacity-70"
          : "inline-flex min-h-11 items-center gap-2 rounded-full border border-(--border-subtle) px-4 text-sm font-semibold text-(--text-primary) hover:bg-(--surface-subtle) disabled:cursor-default disabled:opacity-70"}
        aria-live="polite"
      >
        {statusIcon}
        {displayLabel}
      </button>
      {state.kind === "error" && (
        <span role="status" className="max-w-xs text-xs leading-relaxed text-red-600 dark:text-red-400">
          {state.message}
        </span>
      )}
    </span>
  );
}
