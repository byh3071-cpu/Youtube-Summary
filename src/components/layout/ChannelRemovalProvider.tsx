"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, X } from "lucide-react";
import type { FeedSource } from "@/lib/sources";

const UNDO_WINDOW_MS = 5_000;
const DELETE_TIMEOUT_MS = 12_000;
const SUCCESS_NOTICE_MS = 2_000;

type RemovalPhase = "undo" | "deleting" | "success" | "error";
type PendingRemoval = { source: FeedSource; phase: RemovalPhase; error?: string };
type HiddenSourceIdsAction =
  | { type: "hide"; sourceId: string }
  | { type: "show"; sourceId: string }
  | { type: "prune"; sourceIds: readonly string[] };

interface ChannelRemovalContextValue {
  hiddenSourceIds: ReadonlySet<string>;
  pendingSourceId: string | null;
  pendingPhase: RemovalPhase | null;
  requestRemoval: (source: FeedSource) => void;
  undoRemoval: () => void;
  retryRemoval: () => void;
  dismissNotice: () => void;
}

const ChannelRemovalContext = createContext<ChannelRemovalContextValue | null>(null);

function hiddenSourceIdsReducer(
  current: ReadonlySet<string>,
  action: HiddenSourceIdsAction,
): ReadonlySet<string> {
  if (action.type === "hide") return new Set(current).add(action.sourceId);
  if (action.type === "show") {
    const next = new Set(current);
    next.delete(action.sourceId);
    return next;
  }
  return new Set([...current].filter((sourceId) => action.sourceIds.includes(sourceId)));
}

export function useChannelRemoval() {
  const context = useContext(ChannelRemovalContext);
  if (!context) {
    throw new Error("useChannelRemoval must be used within a ChannelRemovalProvider.");
  }
  return context;
}

export function ChannelRemovalProvider({
  children,
  sourceIds,
}: {
  children: ReactNode;
  sourceIds: readonly string[];
}) {
  const router = useRouter();
  const [hiddenSourceIds, dispatchHiddenSourceIds] = useReducer(hiddenSourceIdsReducer, new Set<string>());
  const [pending, setPending] = useState<PendingRemoval | null>(null);
  const pendingRef = useRef<PendingRemoval | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const setPendingRemoval = useCallback((next: PendingRemoval | null) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  const commitRemoval = useCallback(async (source: FeedSource) => {
    setPendingRemoval({ source, phase: "deleting" });
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), DELETE_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/custom-sources?sourceId=${encodeURIComponent(source.id)}`, {
        method: "DELETE",
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "채널 삭제 요청에 실패했습니다.");
      if (pendingRef.current?.source.id !== source.id) return;
      setPendingRemoval({ source, phase: "success" });
      router.refresh();
    } catch (error) {
      if (pendingRef.current?.source.id !== source.id) return;
      dispatchHiddenSourceIds({ type: "show", sourceId: source.id });
      setPendingRemoval({
        source,
        phase: "error",
        error: error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "응답이 늦어 삭제하지 못했어요.",
      });
    } finally {
      window.clearTimeout(timeoutId);
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }, [router, setPendingRemoval]);

  const requestRemoval = useCallback((source: FeedSource) => {
    if (pendingRef.current) return;
    dispatchHiddenSourceIds({ type: "hide", sourceId: source.id });
    setPendingRemoval({ source, phase: "undo" });
    undoTimerRef.current = window.setTimeout(() => {
      undoTimerRef.current = null;
      void commitRemoval(source);
    }, UNDO_WINDOW_MS);
  }, [commitRemoval, setPendingRemoval]);

  const undoRemoval = useCallback(() => {
    const sourceId = pendingRef.current?.source.id;
    if (!sourceId || pendingRef.current?.phase !== "undo") return;
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    dispatchHiddenSourceIds({ type: "show", sourceId });
    setPendingRemoval(null);
  }, [setPendingRemoval]);

  const retryRemoval = useCallback(() => {
    const current = pendingRef.current;
    if (current?.phase === "error") {
      setPendingRemoval(null);
      requestRemoval(current.source);
    }
  }, [requestRemoval, setPendingRemoval]);

  const dismissNotice = useCallback(() => {
    const phase = pendingRef.current?.phase;
    if (phase !== "success" && phase !== "error") return;
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setPendingRemoval(null);
  }, [setPendingRemoval]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
      if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (pending?.phase !== "success") return;
    const sourceId = pending.source.id;
    successTimerRef.current = window.setTimeout(() => {
      if (pendingRef.current?.source.id === sourceId && pendingRef.current.phase === "success") {
        setPendingRemoval(null);
      }
      successTimerRef.current = null;
    }, SUCCESS_NOTICE_MS);
    return () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, [pending, setPendingRemoval]);

  useEffect(() => {
    dispatchHiddenSourceIds({ type: "prune", sourceIds });
  }, [sourceIds]);

  const value = useMemo<ChannelRemovalContextValue>(() => ({
    hiddenSourceIds,
    pendingSourceId: pending?.source.id ?? null,
    pendingPhase: pending?.phase ?? null,
    requestRemoval,
    undoRemoval,
    retryRemoval,
    dismissNotice,
  }), [dismissNotice, hiddenSourceIds, pending, requestRemoval, retryRemoval, undoRemoval]);

  return (
    <ChannelRemovalContext.Provider value={value}>
      {children}
      {pending && (
        <div
          data-testid="channel-removal-notice"
          role="status"
          className="fixed inset-x-3 bottom-5 z-[90] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-(--border-subtle) bg-(--surface-raised) px-4 py-3 text-sm shadow-lg"
        >
          {pending.phase === "deleting" ? <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden /> : <RotateCcw size={18} className="shrink-0" aria-hidden />}
          <p className="min-w-0 flex-1">
            {pending.phase === "undo" && `${pending.source.name} 채널을 삭제할 예정이에요.`}
            {pending.phase === "deleting" && `${pending.source.name} 채널을 삭제하는 중이에요.`}
            {pending.phase === "success" && `${pending.source.name} 채널을 삭제했어요.`}
            {pending.phase === "error" && (pending.error ?? "채널을 삭제하지 못했어요.")}
          </p>
          {pending.phase === "undo" ? (
            <button
              type="button"
              data-testid="channel-removal-undo"
              onClick={undoRemoval}
              className="shrink-0 rounded-md px-2 py-1 font-semibold text-(--playback-accent) hover:bg-(--surface-subtle)"
            >
              실행 취소
            </button>
          ) : pending.phase === "error" ? (
            <>
              <button
                type="button"
                data-testid="channel-removal-retry"
                onClick={retryRemoval}
                className="shrink-0 rounded-md px-2 py-1 font-semibold text-(--playback-accent) hover:bg-(--surface-subtle)"
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={dismissNotice}
                className="shrink-0 rounded-md p-1 text-(--text-secondary) hover:bg-(--surface-subtle)"
                aria-label="채널 삭제 알림 닫기"
              >
                <X size={16} aria-hidden />
              </button>
            </>
          ) : pending.phase === "success" ? (
            <button
              type="button"
              onClick={dismissNotice}
              className="shrink-0 rounded-md p-1 text-(--text-secondary) hover:bg-(--surface-subtle)"
              aria-label="채널 삭제 알림 닫기"
            >
              <X size={16} aria-hidden />
            </button>
          ) : null}
        </div>
      )}
    </ChannelRemovalContext.Provider>
  );
}
