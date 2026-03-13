"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Bookmark, ListMusic } from "lucide-react";
import { ThemeIcon } from "@/components/ui/ThemeIcon";
import { useTheme } from "next-themes";
import { ModalTransition } from "@/components/ui/ModalTransition";
import { LoginButton } from "@/components/auth/LoginButton";
import { defaultSources, FEED_CATEGORIES } from "@/lib/sources";
import AddChannelButton from "@/components/feed/AddChannelButton";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

const rssSources = defaultSources.filter((s) => s.type === "RSS");
const youtubeStatusLabel = {
  ready: "정상 연결",
  missing_api_key: "키 필요",
  invalid_api_key: "키 오류",
  request_failed: "일시 장애",
} as const;
const youtubeStatusTone = {
  ready: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  missing_api_key: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  invalid_api_key: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  request_failed: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
} as const;

export default function MobileNavDrawer({
  open,
  onClose,
  sourceStatus,
  selectedSourceId,
  selectedCategory,
  youtubeSources,
}: {
  open: boolean;
  onClose: () => void;
  sourceStatus: MergedFeedResult["sourceStatus"];
  selectedSourceId?: string;
  selectedCategory?: string;
  youtubeSources?: FeedSource[];
}) {
  const ytSources = youtubeSources ?? defaultSources.filter((s) => s.type === "YouTube");
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const linkTo = (source?: string, category?: string) => {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (category) params.set("category", category);
    const q = params.toString();
    return q ? `/?${q}` : "/";
  };

  return (
    <ModalTransition
      open={open}
      onClose={onClose}
      overlayClassName="fixed inset-0 z-40 bg-(--notion-fg)/30 md:hidden"
      overlayZ={40}
      panelZ={50}
      variant="left"
      panelClassName="fixed inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-(--notion-border) bg-(--notion-bg) md:hidden"
    >
      <aside className="outline-none" role="dialog" aria-modal="true" aria-label="메뉴">
        <div className="border-b border-(--notion-border) px-4 pt-6 pb-4">
          <div className="relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg) min-h-[36px] min-w-[36px] touch-manipulation"
              aria-label="메뉴 닫기"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="relative h-24 w-24 overflow-hidden rounded-3xl bg-transparent"
                aria-label="테마 전환"
              >
                <Image
                  src="/focus-feed-logo-v2.png"
                  alt="Focus Feed 로고"
                  fill
                  sizes="96px"
                  className="object-contain"
                  priority
                />
              </button>
              <div className="flex items-center justify-center gap-2">
                <LoginButton />
              </div>
            </div>
          </div>
          <Link
            href="/"
            onClick={onClose}
            className={`mt-4 block rounded-xl border px-3 py-3 transition-colors ${selectedSourceId ? "border-transparent bg-(--notion-hover)" : "border-(--notion-border) bg-(--notion-bg)"}`}
          >
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-(--notion-fg)">
              <ThemeIcon name="Feed_List" alt="전체 피드" size={26} />
              전체 피드
            </div>
            <p className="text-xs leading-snug text-(--notion-fg)/60">
              유튜브와 RSS를 한 곳에서 모아 최신순으로 확인합니다.
            </p>
          </Link>
        </div>
        <nav className="space-y-5 p-4">

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-(--notion-fg)/50">
              카테고리
            </p>
            <div className="space-y-0.5 rounded-xl border border-(--notion-border)/60 bg-(--notion-bg)/50 p-1.5">
              <Link
                href="/"
                onClick={onClose}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm ${!selectedCategory ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
              >
                전체
              </Link>
              {FEED_CATEGORIES.map((cat) => (
                <Link
                  key={cat}
                  href={linkTo(undefined, cat)}
                  onClick={onClose}
                  className={`flex items-center rounded-lg px-3 py-2.5 text-sm ${selectedCategory === cat ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
                >
                  {cat}
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-(--notion-fg)/50">
                YouTube ({ytSources.length})
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${youtubeStatusTone[sourceStatus.youtube]}`}>
                {youtubeStatusLabel[sourceStatus.youtube]}
              </span>
            </div>
            <div className="space-y-0.5 rounded-xl border border-(--notion-border)/60 bg-(--notion-bg)/50 p-1.5">
              {ytSources.map((item) => (
                <Link
                  key={item.id}
                  href={linkTo(item.id)}
                  onClick={onClose}
                  className={`flex items-center rounded-lg px-3 py-2.5 text-sm ${selectedSourceId === item.id ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
                >
                  <span className="truncate">{item.name}</span>
                </Link>
              ))}
              <div className="pt-1">
                <AddChannelButton />
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-(--notion-fg)/50">
              내 콘텐츠
            </p>
            <div className="space-y-0.5 rounded-xl border border-(--notion-border)/60 bg-(--notion-bg)/50 p-1.5">
              <Link href="/playlists" onClick={onClose} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-(--notion-fg)/85 hover:bg-(--notion-hover)">
                <ListMusic size={18} className="shrink-0 text-(--notion-fg)/70" />
                내 플레이리스트
              </Link>
              <Link href="/bookmarks" onClick={onClose} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-(--notion-fg)/85 hover:bg-(--notion-hover)">
                <Bookmark size={18} className="shrink-0 text-(--notion-fg)/70" />
                북마크
              </Link>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-(--notion-fg)/50">
              RSS ({rssSources.length})
            </p>
            <div className="space-y-0.5 rounded-xl border border-(--notion-border)/60 bg-(--notion-bg)/50 p-1.5">
              {rssSources.map((item) => (
                <Link
                  key={item.id}
                  href={linkTo(item.id)}
                  onClick={onClose}
                  className={`flex items-center rounded-lg px-3 py-2.5 text-sm ${selectedSourceId === item.id ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : "text-(--notion-fg)/85 hover:bg-(--notion-hover)"}`}
                >
                  <span className="truncate">{item.name}</span>
                </Link>
              ))}
            </div>
          </section>
        </nav>
      </aside>
    </ModalTransition>
  );
}
