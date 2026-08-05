"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, X } from "lucide-react";
import type { FeedSource } from "@/lib/sources";

const UNDO_WINDOW_MS = 5_000;

type RemovalPhase = "undo" | "deleting" | "success" | "error";
type PendingRemoval = { source: FeedSource; phase: RemovalPhase; error?: string };

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
  const [hiddenSourceIds, setHiddenSourceIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pending, setPending] = useState<PendingRemoval | null>(null);
  const pendingRef = useRef<PendingRemoval | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const setPendingRemoval = useCallback((next: PendingRemoval | null) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  const commitRemoval = useCallback(async (source: FeedSource) => {
    const deleting = { source, phase: "deleting" as const };
    setPendingRemoval(deleting);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const response = await fetch(`/api/custom-sources?sourceId=${encodeURIComponent(source.id)}`, {
      method: "DELETE",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("채널 삭제 요청에 실패했습니다.");
    setPendingRemoval({ source, phase: "success" });
    router.refresh();
  }, [router, setPendingRemoval]);

  const requestRemoval = useCallback((source: FeedSource) => {
    if (pendingRef.current) return;
    setHiddenSourceIds((current) => new Set(current).add(source.id));
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
    setHiddenSourceIds((current) => {
      const next = new Set(current);
      next.delete(sourceId);
      return next;
    });
    setPendingRemoval(null);
  }, [setPendingRemoval]);

  const retryRemoval = useCallback(() => {
    const current = pendingRef.current;
    if (current?.phase === "error") {
      void commitRemoval(current.source);
    }
  }, [commitRemoval]);

  const dismissNotice = useCallback(() => {
    if (pendingRef.current?.phase === "undo") return;
    setPendingRemoval(null);
  }, [setPendingRemoval]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const current = pendingRef.current;
    if (current?.phase === "success" && !sourceIds.includes(current.source.id)) {
      setHiddenSourceIds((hidden) => {
        const next = new Set(hidden);
        next.delete(current.source.id);
        return next;
      });
      setPendingRemoval(null);
    }
  }, [sourceIds, setPendingRemoval]);

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
            {pending.phase === "deleting" && "채널을 삭제하고 있어요."}
            {pending.phase === "success" && "채널을 삭제했어요."}
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
          ) : (
            <button
              type="button"
              onClick={dismissNotice}
              className="shrink-0 rounded-md p-1 text-(--text-secondary) hover:bg-(--surface-subtle)"
              aria-label="채널 삭제 알림 닫기"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
      )}
    </ChannelRemovalContext.Provider>
  );
}
