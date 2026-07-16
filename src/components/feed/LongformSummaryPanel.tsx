"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, LogIn, RotateCcw, Sparkles } from "lucide-react";
import { summarizeVideoAction } from "@/app/actions/summarize";

type SummaryState = "idle" | "loading" | "success" | "error";

interface Props {
  videoId: string;
}

function isLoginError(message: string) {
  return message.includes("로그인");
}

export default function LongformSummaryPanel({ videoId }: Props) {
  const [state, setState] = useState<SummaryState>("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const cached = localStorage.getItem(`summary_${videoId}`);

    queueMicrotask(() => {
      if (cancelled) return;
      setSummary(cached);
      setError(null);
      setState(cached ? "success" : "idle");
      requestInFlight.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const generateSummary = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setState("loading");
    setError(null);

    try {
      const result = await summarizeVideoAction(videoId);
      if (result.error) {
        setError(result.error);
        setState("error");
        return;
      }

      if (result.summary) {
        localStorage.setItem(`summary_${videoId}`, result.summary);
        setSummary(result.summary);
        setState("success");
        window.dispatchEvent(new Event("focus-feed:usage-updated"));
        return;
      }

      setError("요약 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setState("error");
    } catch {
      setError("요약 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setState("error");
    } finally {
      requestInFlight.current = false;
    }
  }, [videoId]);

  const loginRequired = !!error && isLoginError(error);
  const returnPath = `/?viewMode=longform&watch=${encodeURIComponent(videoId)}`;

  return (
    <section
      aria-labelledby={`longform-summary-title-${videoId}`}
      aria-busy={state === "loading"}
      data-testid="longform-summary-panel"
      data-summary-state={state}
      className="mt-5 overflow-hidden rounded-2xl border border-(--ai-accent)/18 bg-(--surface-raised) shadow-[0_12px_36px_rgba(74,44,130,0.07)] sm:rounded-3xl"
    >
      <header className="flex items-start gap-3 border-b border-(--ai-accent)/12 bg-(--ai-accent-muted) px-5 py-4 sm:px-6 sm:py-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--ai-accent)/12 text-(--ai-accent)" aria-hidden>
          <Sparkles size={19} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.14em] text-(--ai-accent)">Focus Feed AI</p>
          <h2 id={`longform-summary-title-${videoId}`} className="mb-0! mt-1! text-lg! font-bold tracking-[-0.025em] text-(--text-primary)">
            핵심 3줄 요약
          </h2>
        </div>
      </header>

      <div className="px-5 py-5 sm:px-6 sm:py-6" aria-live="polite">
        {state === "idle" && (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="m-0 text-base font-semibold text-(--text-primary)">긴 영상의 핵심부터 확인하세요.</p>
              <p className="mb-0 mt-1.5 text-sm leading-6 text-(--text-secondary)">
                영상은 그대로 보면서 중요한 내용만 3줄로 정리합니다. 요약 생성에는 로그인이 필요합니다.
              </p>
            </div>
            <button
              type="button"
              data-testid="longform-summary-generate"
              onClick={generateSummary}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-(--ai-accent) px-5 text-sm font-bold text-white shadow-sm transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ai-accent)/40 focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface-raised)"
            >
              <Sparkles size={16} aria-hidden /> AI 요약 생성
            </button>
          </div>
        )}

        {state === "loading" && (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center text-(--text-secondary)" data-testid="longform-summary-loading">
            <Loader2 className="animate-spin text-(--ai-accent)" size={26} aria-hidden />
            <div>
              <p className="m-0 text-sm font-semibold text-(--text-primary)">영상 내용을 정리하고 있습니다.</p>
              <p className="mb-0 mt-1 text-xs leading-5">완료될 때까지 현재 영상을 계속 시청할 수 있습니다.</p>
            </div>
          </div>
        )}

        {state === "error" && error && (
          <div className="flex flex-col gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="longform-summary-error">
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" size={20} aria-hidden />
              <div>
                <p className="m-0 text-sm font-bold text-(--text-primary)">{loginRequired ? "로그인 후 요약을 생성할 수 있어요." : "요약을 생성하지 못했습니다."}</p>
                <p className="mb-0 mt-1 text-sm leading-6 text-(--text-secondary)">{error}</p>
              </div>
            </div>
            {loginRequired ? (
              <Link
                href={`/login?next=${encodeURIComponent(returnPath)}`}
                style={{ color: "var(--surface-raised)" }}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-(--text-primary) px-5 text-sm font-bold transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--text-primary)/30"
              >
                <LogIn size={17} aria-hidden /> 로그인
              </Link>
            ) : (
              <button
                type="button"
                onClick={generateSummary}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-(--border-subtle) bg-(--surface-raised) px-5 text-sm font-bold text-(--text-primary) hover:bg-(--surface-subtle) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ai-accent)/35"
              >
                <RotateCcw size={16} aria-hidden /> 다시 시도
              </button>
            )}
          </div>
        )}

        {state === "success" && summary && (
          <div className="whitespace-pre-wrap break-keep rounded-2xl bg-(--surface-subtle) px-4 py-4 text-[15px] leading-7 text-(--text-primary) sm:px-5 sm:py-5" data-testid="longform-summary-content">
            {summary}
          </div>
        )}
      </div>
    </section>
  );
}
