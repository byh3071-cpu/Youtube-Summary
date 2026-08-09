"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, Youtube } from "lucide-react";
import { FEED_CATEGORIES } from "@/lib/sources";
import type { FeedCategory } from "@/types/feed";

interface ResolvedChannel {
  channelId: string;
  channelName: string;
  avatarUrl?: string;
}

type Status =
  | { kind: "no-input" }
  | { kind: "resolving" }
  | { kind: "resolved"; channel: ResolvedChannel }
  | { kind: "adding"; channel: ResolvedChannel }
  | { kind: "done"; channel: ResolvedChannel; restored: boolean }
  | { kind: "error"; message: string };

/**
 * 공유 파라미터에서 추가할 대상 추출.
 * 안드로이드 공유는 URL이 url이 아니라 text(EXTRA_TEXT)에 오는 경우가 많고
 * 캡션이 섞일 수 있어, 정규식으로 첫 http(s) URL만 뽑는다.
 */
function extractSharedInput(params: URLSearchParams): string | null {
  for (const key of ["url", "text", "title"] as const) {
    const value = params.get(key);
    if (!value) continue;
    const match = value.match(/https?:\/\/\S+/);
    if (match) return match[0];
  }
  // URL이 없으면 @핸들 등 원문 입력으로 시도
  return params.get("url") ?? params.get("text");
}

export default function AddDeepLinkClient() {
  const searchParams = useSearchParams();
  const sharedInput = extractSharedInput(new URLSearchParams(searchParams?.toString()));
  const [status, setStatus] = useState<Status>(() =>
    sharedInput ? { kind: "resolving" } : { kind: "no-input" },
  );
  const [category, setCategory] = useState<FeedCategory>("기타");
  const startedRef = useRef(false);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (startedRef.current || !sharedInput) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/youtube/resolve-channel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: sharedInput }),
        });
        const data = (await res.json()) as ResolvedChannel & { error?: string };
        if (!res.ok) {
          setStatus({ kind: "error", message: data.error ?? "채널을 찾을 수 없습니다." });
          return;
        }
        setStatus({ kind: "resolved", channel: data });
      } catch {
        setStatus({ kind: "error", message: "연결 오류. 다시 시도해 주세요." });
      }
    })();
  }, [sharedInput]);

  // React는 javascript: href를 보안상 렌더링하지 않으므로 ref로 심는다 (드래그 설치용)
  useEffect(() => {
    const el = bookmarkletRef.current;
    if (!el) return;
    el.setAttribute(
      "href",
      `javascript:location.href='${window.location.origin}/add?url='+encodeURIComponent(location.href)`,
    );
  }, [status.kind]);

  const addChannel = useCallback(async () => {
    if (status.kind !== "resolved") return;
    const channel = status.channel;
    setStatus({ kind: "adding", channel });
    try {
      const res = await fetch("/api/custom-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: channel.channelId,
          name: channel.channelName,
          category,
          avatarUrl: channel.avatarUrl ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; restored?: boolean }
        | null;
      if (res.status === 409) {
        // 이미 보이는 기본 채널 — 실패가 아니라 "이미 있음"으로 안내
        setStatus({ kind: "done", channel, restored: true });
        return;
      }
      if (!res.ok) {
        setStatus({ kind: "error", message: data?.error ?? "채널 저장에 실패했습니다." });
        return;
      }
      setStatus({ kind: "done", channel, restored: data?.restored === true });
    } catch {
      setStatus({ kind: "error", message: "연결 오류. 다시 시도해 주세요." });
    }
  }, [status, category]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-5 py-10 text-(--notion-fg)">
      <div className="flex items-center gap-2">
        <Youtube size={20} className="text-red-500" />
        <h1 className="text-lg font-semibold">Focus Feed에 채널 추가</h1>
      </div>

      {status.kind === "resolving" && (
        <div className="flex items-center gap-2 rounded-xl border border-(--notion-border) p-4 text-sm text-(--notion-fg)/70">
          <Loader2 size={16} className="animate-spin" /> 채널 확인 중…
        </div>
      )}

      {(status.kind === "resolved" || status.kind === "adding") && (
        <div className="rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4">
          <div className="mb-3 flex items-center gap-3">
            {status.channel.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={status.channel.avatarUrl}
                alt={status.channel.channelName}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--notion-hover) text-sm font-semibold">
                {status.channel.channelName.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-medium">{status.channel.channelName}</div>
              <div className="text-xs text-(--notion-fg)/55">이 채널을 피드에 추가할까요?</div>
            </div>
          </div>
          <label htmlFor="add-deeplink-category" className="mb-1.5 block text-xs font-medium text-(--notion-fg)/60">
            카테고리
          </label>
          <select
            id="add-deeplink-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedCategory)}
            className="mb-4 w-full rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-sm focus:border-(--notion-fg)/30 focus:outline-none"
            disabled={status.kind === "adding"}
          >
            {FEED_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Link
              href="/"
              className="rounded-lg border border-(--notion-border) px-4 py-2 text-sm font-medium text-(--notion-fg)/80 hover:bg-(--notion-hover)"
            >
              취소
            </Link>
            <button
              type="button"
              onClick={addChannel}
              disabled={status.kind === "adding"}
              className="flex items-center gap-2 rounded-lg bg-(--notion-fg) px-4 py-2 text-sm font-medium text-(--notion-bg) hover:opacity-90 disabled:opacity-60"
            >
              {status.kind === "adding" ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> 추가 중…
                </>
              ) : (
                <>
                  <Plus size={16} /> 추가
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {status.kind === "done" && (
        <div className="rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4">
          <div className="mb-2 font-medium">
            {status.restored
              ? `${status.channel.channelName} 채널이 피드에 있어요.`
              : `${status.channel.channelName} 채널을 추가했어요.`}
          </div>
          <p className="mb-4 text-xs leading-relaxed text-(--notion-fg)/55">
            팁: 유튜브 앱에서 Focus Feed로 공유한 뒤, 지식 캡처 화면의 [이 영상의 채널을
            피드에 추가]를 누르면 이 화면으로 올 수 있어요.
          </p>
          <Link
            href={`/?source=${encodeURIComponent(status.channel.channelId)}`}
            className="inline-flex rounded-lg bg-(--notion-fg) px-4 py-2 text-sm font-medium text-(--notion-bg) hover:opacity-90"
          >
            피드에서 보기
          </Link>
        </div>
      )}

      {status.kind === "error" && (
        <div className="rounded-xl border border-red-300/50 bg-(--notion-bg) p-4">
          <div className="mb-3 text-sm text-red-600 dark:text-red-400">{status.message}</div>
          <Link
            href="/"
            className="inline-flex rounded-lg border border-(--notion-border) px-4 py-2 text-sm font-medium text-(--notion-fg)/80 hover:bg-(--notion-hover)"
          >
            피드로 돌아가기
          </Link>
        </div>
      )}

      {status.kind === "no-input" && (
        <div className="rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4 text-sm leading-relaxed">
          <p className="mb-3 text-(--notion-fg)/75">
            이 페이지는 공유·북마클릿으로 채널을 바로 추가하는 입구예요. 링크 없이 열려서
            추가할 채널이 없어요.
          </p>
          <ul className="mb-4 list-disc space-y-2 pl-5 text-(--notion-fg)/65">
            <li>
              <span className="font-medium text-(--notion-fg)">폰:</span> Focus Feed를 홈 화면에
              추가하면, 유튜브 앱에서 공유 → Focus Feed → [이 영상의 채널을 피드에 추가]
              순서로 올 수 있어요. (iOS share target은 미지원)
            </li>
            <li>
              <span className="font-medium text-(--notion-fg)">데스크톱:</span> 아래 버튼을
              북마크바에 드래그해 두고, 유튜브에서 영상·채널을 보다가 클릭하면 돼요.
            </li>
          </ul>
          <a
            ref={bookmarkletRef}
            href="#"
            draggable
            onClick={(e) => e.preventDefault()}
            className="inline-flex cursor-grab rounded-lg border border-dashed border-(--notion-fg)/40 px-4 py-2 text-sm font-medium hover:bg-(--notion-hover)"
            title="이 버튼을 북마크바로 드래그하세요"
          >
            ＋ FF에 채널 추가
          </a>
          <div className="mt-4">
            <Link href="/" className="text-xs text-(--notion-fg)/55 underline hover:text-(--notion-fg)">
              피드로 돌아가기
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
