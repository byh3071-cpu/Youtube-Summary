"use client";

import { useEffect, useState, type DragEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp, GripVertical, ListMusic, Save, Trash2, X } from "lucide-react";
import { useRadioQueueOptional, type RadioQueueItem } from "@/contexts/RadioQueueContext";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { qaLog } from "@/lib/qa-log";
import { AutoAnimateList } from "@/components/ui/AutoAnimateList";
import { ModalTransition } from "@/components/ui/ModalTransition";

interface RadioPlaylistDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}

function QueueThumbnail({ item, size = 48 }: { item: RadioQueueItem; size?: number }) {
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-xl bg-(--surface-subtle)"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Image
        src={`https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/mqdefault.jpg`}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-cover"
      />
    </span>
  );
}

export function RadioPlaylistDrawer({ drawerOpen, setDrawerOpen }: RadioPlaylistDrawerProps) {
  const radio = useRadioQueueOptional();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setIsLoggedIn(false);
      return;
    }
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (mounted) setIsLoggedIn(!!session);
      })
      .catch(() => {
        if (mounted) setIsLoggedIn(false);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setIsLoggedIn(!!session);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!radio || !radio.currentItem) return null;

  const handleSavePlaylist = async () => {
    if (!radio.queue.length || saving) return;
    if (isLoggedIn === false) {
      setSaveMessage("플레이리스트 저장은 로그인 후 이용할 수 있어요.");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/playlists/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: radio.queue,
          title: "라디오 플레이리스트",
        }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || data.error) {
        setSaveMessage(data.error ?? "플레이리스트 저장에 실패했습니다.");
      } else {
        setSaveMessage("플레이리스트가 저장되었습니다.");
        qaLog.radio.playlistSaved(radio.queue.length);
      }
    } catch {
      setSaveMessage("플레이리스트 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const nextItems = radio.queue
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index > radio.currentIndex);
  const previousItems = radio.queue
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index < radio.currentIndex);

  const moveItem = (fromIndex: number, toIndex: number) => {
    radio.moveQueueItem(fromIndex, toIndex);
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const dragProps = (index: number) => ({
    draggable: radio.queue.length > 1,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      setDraggedIndex(index);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTargetIndex(index);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const parsedIndex = Number(event.dataTransfer.getData("text/plain"));
      const fromIndex = Number.isInteger(parsedIndex) ? parsedIndex : draggedIndex;
      if (fromIndex !== null) moveItem(fromIndex, index);
    },
    onDragEnd: () => {
      setDraggedIndex(null);
      setDropTargetIndex(null);
    },
  });

  const renderOrderControls = (item: RadioQueueItem, index: number) => (
    <div className="flex shrink-0 items-center gap-0.5" aria-label={`${item.title} 순서 변경`} role="group">
      <button
        type="button"
        onClick={() => moveItem(index, index - 1)}
        disabled={index === 0}
        className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full text-(--text-secondary) transition-colors hover:bg-(--surface-subtle) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/35 disabled:cursor-not-allowed disabled:opacity-25"
        aria-label={`${item.title} 한 칸 앞으로 이동`}
      >
        <ChevronUp size={16} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => moveItem(index, index + 1)}
        disabled={index === radio.queue.length - 1}
        className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full text-(--text-secondary) transition-colors hover:bg-(--surface-subtle) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/35 disabled:cursor-not-allowed disabled:opacity-25"
        aria-label={`${item.title} 한 칸 뒤로 이동`}
      >
        <ChevronDown size={16} aria-hidden />
      </button>
    </div>
  );

  const renderQueueRow = ({ item, index }: { item: RadioQueueItem; index: number }) => (
    <li
      key={item.videoId}
      data-testid="queue-item"
      data-queue-index={index}
      className={`group flex min-h-[68px] items-center gap-2 rounded-xl px-2 py-2 transition-[background-color,box-shadow,opacity] hover:bg-(--surface-subtle) ${
        dropTargetIndex === index && draggedIndex !== index
          ? "bg-(--playback-accent-muted) ring-2 ring-inset ring-(--playback-accent)/45"
          : ""
      } ${draggedIndex === index ? "opacity-50" : ""}`}
      {...dragProps(index)}
    >
      <GripVertical size={18} className="hidden shrink-0 cursor-grab text-(--text-secondary) md:block" aria-hidden />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/35"
        onClick={() => {
          radio.setCurrentIndex(index);
          setDrawerOpen(false);
        }}
        aria-label={`${item.title} 재생`}
      >
        <QueueThumbnail item={item} />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-semibold leading-5 text-(--text-primary)">{item.title}</span>
          <span className="mt-0.5 block text-[11px] text-(--text-secondary)">대기열 {index + 1}번째</span>
        </span>
      </button>
      {renderOrderControls(item, index)}
      <button
        type="button"
        onClick={() => {
          qaLog.radio.queueRemoved(index, item.videoId);
          radio.removeFromQueue(index);
        }}
        className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-(--text-secondary) transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35 dark:hover:text-red-400"
        aria-label={`${item.title} 목록에서 제거`}
      >
        <Trash2 size={16} />
      </button>
    </li>
  );

  return (
    <ModalTransition
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      overlayClassName="fixed inset-0 bg-black/15 backdrop-blur-[1px] md:bg-black/10"
      overlayZ={55}
      panelZ={56}
      variant="bottom"
      panelRole="dialog"
      panelAriaLabel="재생 대기열"
      panelTestId="radio-queue-panel"
      panelClassName="scroll-lock-stable-right fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+1px)] left-3 right-3 flex max-h-[72dvh] flex-col overflow-hidden rounded-t-[24px] border border-b-0 border-(--border-subtle) bg-(--surface-raised) shadow-[0_-20px_60px_rgba(15,23,42,0.18)] md:bottom-[5.75rem] md:left-auto md:right-6 md:w-[420px] md:max-h-[calc(100dvh-7.5rem)] md:rounded-2xl md:border md:shadow-[var(--shadow-lg)]"
    >
      <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-(--text-secondary)/25 md:hidden" aria-hidden />

      <header className="shrink-0 border-b border-(--border-subtle) px-4 pb-3 pt-3 md:px-5 md:pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-(--text-secondary)">
              <ListMusic size={16} className="text-(--playback-accent)" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em]">Radio queue</span>
            </div>
            <h2 className="m-0! mt-1.5! text-lg! font-bold leading-tight! tracking-[-0.02em] text-(--text-primary)">재생 대기열</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isLoggedIn === false ? (
              <Link
                href="/login?next=/"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-(--border-subtle) px-3 text-xs font-semibold text-(--text-primary) hover:bg-(--surface-subtle)"
              >
                <Save size={14} /> 로그인 후 저장
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleSavePlaylist}
                disabled={saving || radio.queue.length === 0 || isLoggedIn === null}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-(--border-subtle) px-3 text-xs font-semibold text-(--text-primary) hover:bg-(--surface-subtle) disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={14} /> {saving ? "저장 중" : "저장"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full text-(--text-secondary) hover:bg-(--surface-subtle) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/35"
              aria-label="대기열 닫기"
            >
              <X size={19} />
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-(--text-secondary)">총 {radio.queue.length}개 · 현재 {radio.currentIndex + 1}번째</span>
          <button
            type="button"
            onClick={() => radio.close()}
            className="min-h-10 rounded-full px-2.5 font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            전체 비우기
          </button>
        </div>
        {saveMessage ? (
          <p className="mt-1.5 text-[11px] text-(--text-secondary)" aria-live="polite">{saveMessage}</p>
        ) : isLoggedIn === false ? (
          <p className="mt-1.5 text-[11px] text-(--text-secondary)">로그인하면 현재 대기열을 플레이리스트로 저장할 수 있어요.</p>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-4">
        <section aria-labelledby="current-radio-item">
          <h3 id="current-radio-item" className="m-0! px-1 text-xs! font-bold leading-5! text-(--text-secondary)">현재 재생</h3>
          <div
            data-testid="current-queue-item"
            data-queue-index={radio.currentIndex}
            className={`mt-2 flex items-center gap-3 rounded-2xl bg-(--playback-accent-muted) p-3 ring-1 ring-inset ring-(--playback-accent)/25 transition-[box-shadow,opacity] ${
              dropTargetIndex === radio.currentIndex && draggedIndex !== radio.currentIndex
                ? "ring-2 ring-(--playback-accent)/55"
                : ""
            } ${draggedIndex === radio.currentIndex ? "opacity-50" : ""}`}
            {...dragProps(radio.currentIndex)}
          >
            <GripVertical size={18} className="hidden shrink-0 cursor-grab text-(--text-secondary) md:block" aria-hidden />
            <QueueThumbnail item={radio.currentItem} size={56} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-bold leading-5 text-(--text-primary)">{radio.currentItem.title}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="inline-flex items-end gap-0.5" aria-hidden>
                  <span className="h-2 w-0.5 rounded-full bg-current" />
                  <span className="h-3 w-0.5 rounded-full bg-current" />
                  <span className="h-1.5 w-0.5 rounded-full bg-current" />
                </span>
                {radio.isPlaying ? "재생 중" : "일시정지"}
              </div>
            </div>
            {renderOrderControls(radio.currentItem, radio.currentIndex)}
            <button
              type="button"
              onClick={() => {
                qaLog.radio.queueRemoved(radio.currentIndex, radio.currentItem!.videoId);
                radio.removeFromQueue(radio.currentIndex);
              }}
              className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-(--text-secondary) hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35 dark:hover:text-red-400"
              aria-label={`${radio.currentItem.title} 목록에서 제거`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </section>

        <section aria-labelledby="next-radio-items" className="mt-5">
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 id="next-radio-items" className="m-0! text-xs! font-bold leading-5! text-(--text-secondary)">다음 재생</h3>
            <span className="text-[11px] text-(--text-secondary)">{nextItems.length}개</span>
          </div>
          {nextItems.length > 0 ? (
            <AutoAnimateList as="ul" className="mt-1.5 space-y-1">
              {nextItems.map(renderQueueRow)}
            </AutoAnimateList>
          ) : (
            <p className="mt-2 rounded-xl bg-(--surface-subtle) px-3 py-4 text-center text-xs text-(--text-secondary)">다음 재생 항목이 없습니다.</p>
          )}
        </section>

        {previousItems.length > 0 && (
          <section aria-labelledby="previous-radio-items" className="mt-5">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 id="previous-radio-items" className="m-0! text-xs! font-bold leading-5! text-(--text-secondary)">이전에 재생됨</h3>
              <span className="text-[11px] text-(--text-secondary)">{previousItems.length}개</span>
            </div>
            <AutoAnimateList as="ul" className="mt-1.5 space-y-1 opacity-80">
              {previousItems.map(renderQueueRow)}
            </AutoAnimateList>
          </section>
        )}
      </div>
    </ModalTransition>
  );
}
