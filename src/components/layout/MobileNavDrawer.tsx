"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname } from "next/navigation";
import { X, Bookmark, ListMusic, Film, Clapperboard, Radio, TrendingUp, LayoutGrid, Youtube, Rss } from "lucide-react";
import { ModalTransition } from "@/components/ui/ModalTransition";
import { LoginButton } from "@/components/auth/LoginButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { defaultSources } from "@/lib/sources";
import AddChannelButton from "@/components/feed/AddChannelButton";
import YouTubeSourceList from "@/components/layout/YouTubeSourceList";
import KnowledgeNavLink from "@/components/layout/KnowledgeNavLink";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

const rssSources = defaultSources.filter((s) => s.type === "RSS");
const youtubeStatusLabel = {
  ready: "정상 연결",
  missing_api_key: "키 필요",
  invalid_api_key: "연동 설정 오류",
  request_failed: "일시 장애",
} as const;
const youtubeStatusTone = {
  ready: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  missing_api_key: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  invalid_api_key: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  request_failed: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
} as const;

function normalizeRoute(route: string) {
  const [pathname, query = ""] = route.split("?");
  const params = new URLSearchParams(query);
  params.sort();
  const normalizedQuery = params.toString();
  return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
}

export default function MobileNavDrawer({
  open,
  onClose,
  onNavigate,
  sourceStatus,
  selectedSourceId,
  selectedCategory,
  youtubeSources,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate?: () => void;
  sourceStatus: MergedFeedResult["sourceStatus"];
  selectedSourceId?: string;
  selectedCategory?: string;
  youtubeSources?: FeedSource[];
}) {
  const ytSources = youtubeSources ?? defaultSources.filter((s) => s.type === "YouTube");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const viewMode = searchParams?.get("viewMode") ?? null;
  const query = searchParams?.toString() ?? "";
  const currentRoute = normalizeRoute(query ? `${pathname}?${query}` : pathname);

  const linkTo = (source?: string) => {
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    const q = params.toString();
    return q ? `/?${q}` : "/";
  };

  const handleNavigation = (href: string) => {
    if (normalizeRoute(href) !== currentRoute) onNavigate?.();
    onClose();
  };

  return (
    <ModalTransition
      open={open}
      onClose={onClose}
      overlayClassName="fixed inset-0 z-40 bg-(--notion-fg)/30 lg:hidden"
      overlayZ={40}
      panelZ={50}
      variant="left"
      panelClassName="fixed inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto overflow-x-hidden overscroll-contain bg-white dark:bg-(--notion-bg) lg:hidden"
      panelRole="dialog"
      panelAriaLabel="메뉴"
      panelId="mobile-navigation-drawer"
    >
      <aside data-testid="mobile-nav-drawer" className="outline-none pb-24 lg:pb-0" aria-label="모바일 탐색">
        <div className="px-4 pb-2 pt-5">
          <div className="relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg) min-h-[44px] min-w-[44px] touch-manipulation"
              aria-label="메뉴 닫기"
            >
              <X size={20} />
            </button>
            <div className="flex w-full flex-col items-start gap-3">
              <div className="relative h-12 w-[160px] shrink-0 overflow-hidden rounded-lg">
                <Image
                  src="/rogo.png"
                  alt="Focus Feed"
                  fill
                  sizes="160px"
                  className="object-cover object-left dark:hidden"
                  priority
                />
                <Image
                  src="/rogo-dark.png"
                  alt="Focus Feed"
                  fill
                  sizes="160px"
                  className="hidden object-cover object-left dark:block"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
        <nav className="space-y-7 px-4 py-3">
          <section aria-label="주요 메뉴" className="space-y-1">
            {[
              { href: "/", label: "홈", icon: LayoutGrid, active: pathname === "/" && !selectedSourceId && !selectedCategory && !viewMode },
              { href: "/trends", label: "트렌드", icon: TrendingUp, active: pathname === "/trends" },
              { href: "/?viewMode=longform", label: "동영상", icon: Film, active: viewMode === "longform" },
              { href: "/?viewMode=shortform", label: "숏폼", icon: Clapperboard, active: viewMode === "shortform" },
              { href: "/?viewMode=live", label: "라이브", icon: Radio, active: viewMode === "live" },
            ].map(({ href, label, icon: Icon, active }) => (
              <Link
                key={href}
                href={href}
                onClick={() => handleNavigation(href)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-(--surface-subtle) font-semibold text-(--text-primary)" : "font-medium text-(--text-secondary) hover:bg-(--surface-subtle) hover:text-(--text-primary)"}`}
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </Link>
            ))}
          </section>

          <section data-testid="mobile-account-settings" aria-label="계정 및 설정" className="rounded-2xl bg-(--surface-subtle) p-2">
            <div className="px-1 pb-1"><LoginButton /></div>
            <ThemeToggle />
            <div className="flex gap-4 px-2 py-2 text-xs font-medium text-(--text-primary)/70">
              <Link href="/pricing" onClick={onClose} className="hover:text-(--text-primary)">요금제</Link>
              <Link href="/landing" onClick={onClose} className="hover:text-(--text-primary)">소개</Link>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <span className="flex items-center gap-2 text-xs font-semibold text-(--text-primary)/70">
                <Youtube size={15} className="text-red-500" />
                구독 채널 · {ytSources.length}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${youtubeStatusTone[sourceStatus.youtube]}`}>
                {youtubeStatusLabel[sourceStatus.youtube]}
              </span>
            </div>
            <div className="space-y-0.5">
              <YouTubeSourceList
                items={ytSources}
                selectedSourceId={selectedSourceId}
                onSelect={(sourceId) => handleNavigation(linkTo(sourceId))}
                showRemoveActions
              />
              <div className="pt-1">
                <AddChannelButton />
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-xs font-semibold text-(--text-primary)/70">
              보관함
            </p>
            <div className="space-y-0.5">
              <KnowledgeNavLink mobile onClick={() => handleNavigation("/knowledge")} />
              <Link href="/playlists" onClick={() => handleNavigation("/playlists")} aria-current={pathname === "/playlists" ? "page" : undefined} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-(--text-secondary) hover:bg-(--surface-subtle) hover:text-(--text-primary)">
                <ListMusic size={18} className="shrink-0 text-(--notion-fg)/70" />
                내 플레이리스트
              </Link>
              <Link href="/bookmarks" onClick={() => handleNavigation("/bookmarks")} aria-current={pathname === "/bookmarks" ? "page" : undefined} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-(--text-secondary) hover:bg-(--surface-subtle) hover:text-(--text-primary)">
                <Bookmark size={18} className="shrink-0 text-(--notion-fg)/70" />
                북마크
              </Link>
            </div>
          </section>

          <section>
            <p className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-(--text-primary)/70">
              <Rss size={15} className="text-blue-500" />
              뉴스 소스 · {rssSources.length}
            </p>
            <div className="space-y-0.5">
              {rssSources.map((item) => (
                <Link
                  key={item.id}
                  href={linkTo(item.id)}
                  onClick={() => handleNavigation(linkTo(item.id))}
                  aria-current={selectedSourceId === item.id ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-xl px-3 py-2.5 text-sm ${selectedSourceId === item.id ? "bg-(--surface-subtle) font-semibold text-(--text-primary)" : "text-(--text-secondary) hover:bg-(--surface-subtle) hover:text-(--text-primary)"}`}
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
