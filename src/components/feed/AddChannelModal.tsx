"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Plus } from "lucide-react";
import { ModalTransition } from "@/components/ui/ModalTransition";
import {
  CUSTOM_SOURCES_COOKIE_NAME,
  HIDDEN_SOURCES_COOKIE_NAME,
  getCustomSourcesFromCookie,
  getHiddenSourceIdsFromCookie,
} from "@/lib/custom-sources-cookie";
import { FEED_CATEGORIES, defaultSources } from "@/lib/sources";
import type { FeedCategory } from "@/types/feed";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export default function AddChannelModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [category, setCategory] = useState<FeedCategory>("기타");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addChannel = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("채널 URL 또는 ID를 입력해 주세요.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/youtube/resolve-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "채널을 찾을 수 없습니다.");
        return;
      }
      const { channelId, channelName, avatarUrl } = data as {
        channelId: string;
        channelName: string;
        avatarUrl?: string;
      };
      const customRaw = getCookie(CUSTOM_SOURCES_COOKIE_NAME);
      const existing = getCustomSourcesFromCookie(customRaw);
      // 숨기지 않은 기본 채널도 "이미 있음" — 숨긴 기본 채널은 서버가 복원 처리
      const hiddenIds = getHiddenSourceIdsFromCookie(getCookie(HIDDEN_SOURCES_COOKIE_NAME));
      const isVisibleDefault =
        defaultSources.some((s) => s.type === "YouTube" && s.id === channelId) &&
        !hiddenIds.includes(channelId);
      const already = existing.some((s) => s.id === channelId) || isVisibleDefault;
      if (already) {
        setError("이미 추가된 채널입니다.");
        return;
      }
      // 쿠키·DB 저장은 모두 서버가 담당 (Set-Cookie 단일 쓰기 경로)
      const syncRes = await fetch("/api/custom-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: channelId,
          name: channelName,
          category,
          avatarUrl: avatarUrl ?? undefined,
        }),
      });
      if (!syncRes.ok) {
        const failed = (await syncRes.json().catch(() => null)) as { error?: string } | null;
        setError(failed?.error ?? "채널 저장에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      const saveResult = (await syncRes.json().catch(() => null)) as
        | { saved?: boolean; cookieStored?: boolean }
        | null;
      // 쿠키 한도 초과로 계정(DB)에만 저장된 경우 — 다른 기기·비로그인에서 안 보이는 이유를 알린다
      if (saveResult?.cookieStored === false && saveResult.saved) {
        window.alert(
          "이 기기의 저장 한도가 가득 차 채널이 계정에만 보관됐어요. 로그인 상태에서는 정상 표시됩니다.",
        );
      }
      onAdded?.();
      onClose();
      setInput("");
      router.refresh();
    } catch {
      setError("연결 오류. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [input, category, onClose, onAdded, router]);

  return (
    <ModalTransition
      open={open}
      onClose={onClose}
      overlayZ={100}
      panelZ={101}
      panelClassName="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-5 shadow-xl"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-channel-title"
        className="outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="add-channel-title" className="text-lg font-semibold text-(--notion-fg)">
            YouTube 채널 추가
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        <p className="mb-3 text-sm text-(--notion-fg)/65">
          채널 주소, @핸들, 보고 있던 영상 링크 모두 됩니다. 영상 링크면 그 채널을 찾아드려요.
        </p>
        <div className="mb-3">
          <label htmlFor="add-channel-category" className="mb-1.5 block text-xs font-medium text-(--notion-fg)/60">
            카테고리
          </label>
          <select
            id="add-channel-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedCategory)}
            className="mb-3 w-full rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-sm text-(--notion-fg) focus:border-(--notion-fg)/30 focus:outline-none"
          >
            {FEED_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="add-channel-input" className="mb-1.5 block text-xs font-medium text-(--notion-fg)/60">
            채널·영상 주소 또는 @핸들
          </label>
          <input
            id="add-channel-input"
            name="channelUrl"
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && addChannel()}
            placeholder="예: youtube.com/@jocoding 또는 영상 링크"
            className="w-full rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2.5 text-sm text-(--notion-fg) placeholder:text-(--notion-fg)/40 focus:border-(--notion-fg)/30 focus:outline-none"
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? "add-channel-error" : undefined}
          />
          {error && (
            <p id="add-channel-error" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-(--notion-border) px-4 py-2 text-sm font-medium text-(--notion-fg)/80 hover:bg-(--notion-hover)"
          >
            취소
          </button>
          <button
            type="button"
            onClick={addChannel}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-(--notion-fg) px-4 py-2 text-sm font-medium text-(--notion-bg) hover:opacity-90 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                확인 중…
              </>
            ) : (
              <>
                <Plus size={16} />
                추가
              </>
            )}
          </button>
        </div>
      </div>
    </ModalTransition>
  );
}
