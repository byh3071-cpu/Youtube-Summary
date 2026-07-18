 "use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname } from "next/navigation";
import { Rss, Youtube, Bookmark, ListMusic, Film, Clapperboard, Radio, Users, TrendingUp, LayoutGrid } from "lucide-react";
import { defaultSources } from "@/lib/sources";
import { LoginButton } from "@/components/auth/LoginButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import AddChannelButton from "@/components/feed/AddChannelButton";
import SourceExportImport from "@/components/feed/SourceExportImport";
import YouTubeSourceList from "@/components/layout/YouTubeSourceList";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

const primaryItemClass = (active: boolean) =>
    `flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
        active
            ? "bg-(--surface-raised) font-semibold text-(--text-primary) shadow-[var(--shadow-xs)]"
            : "font-medium text-(--text-secondary) hover:bg-(--surface-raised)/70 hover:text-(--text-primary)"
    }`;

export default function Sidebar({
    selectedSourceId,
    selectedCategory,
    youtubeSources: youtubeSourcesProp,
    latestVideoBySource,
}: {
    sourceStatus: MergedFeedResult["sourceStatus"];
    selectedSourceId?: string;
    selectedCategory?: string;
    youtubeSources?: FeedSource[];
    latestVideoBySource?: Record<string, string>;
}) {
    const youtubeSources = youtubeSourcesProp ?? defaultSources.filter((s) => s.type === "YouTube");
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const viewMode = searchParams?.get("viewMode") ?? null;
    const radio = useRadioQueueOptional();
    const playerActive = !!radio?.queue.length;
    return (
        <aside data-testid="desktop-sidebar" className="sticky top-0 hidden h-screen w-[260px] shrink-0 overflow-hidden border-r border-(--border-subtle) bg-(--surface-subtle)/45 lg:flex lg:flex-col">
            <div className="shrink-0 px-3 pb-2 pt-3">
                <div className="flex flex-col items-stretch gap-1">
                    <Link href="/" className="relative mb-2 block h-11 w-[172px] shrink-0 overflow-hidden rounded-lg">
                        <Image
                            src="/rogo.png"
                            alt="Focus Feed"
                            fill
                            sizes="172px"
                            className="object-cover object-left dark:hidden"
                        />
                        <Image
                            src="/rogo-dark.png"
                            alt="Focus Feed"
                            fill
                            sizes="172px"
                            className="hidden object-cover object-left dark:block"
                        />
                    </Link>
                    <nav aria-label="주요 메뉴" className="space-y-1">
                        <Link href="/" className={primaryItemClass(!selectedSourceId && !selectedCategory && !viewMode && pathname === "/")}>
                            <LayoutGrid size={17} className="shrink-0" />
                            홈
                        </Link>
                        <Link href="/trends" className={primaryItemClass(pathname === "/trends")}>
                            <TrendingUp size={17} className="shrink-0" />
                            트렌드
                        </Link>
                        <Link href="/?viewMode=longform" className={primaryItemClass(viewMode === "longform")}>
                            <Film size={17} className="shrink-0" />
                            동영상
                        </Link>
                        <Link href="/?viewMode=shortform" className={primaryItemClass(viewMode === "shortform")}>
                            <Clapperboard size={17} className="shrink-0" />
                            숏폼
                        </Link>
                        <Link href="/?viewMode=live" className={primaryItemClass(viewMode === "live")}>
                            <Radio size={17} className="shrink-0" />
                            라이브
                        </Link>
                    </nav>
                </div>
            </div>

            <nav aria-label="구독 및 보관함" className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
                <section>
                    <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold text-(--text-primary)/70">
                        <Youtube size={15} className="text-red-500" />
                        <span>구독 채널</span>
                        <span className="font-medium">{youtubeSources.length}</span>
                    </div>
                    <YouTubeSourceList
                        items={youtubeSources}
                        selectedSourceId={selectedSourceId}
                        latestVideoBySource={latestVideoBySource}
                    />
                    <AddChannelButton />
                    <SourceExportImport />
                </section>

                <SidebarSection
                    title={`뉴스 소스 · ${defaultSources.filter((s) => s.type === "RSS").length}`}
                    items={defaultSources.filter((s) => s.type === "RSS")}
                    icon={<Rss size={15} className="text-blue-500" />}
                    statusLabel=""
                    statusTone=""
                    helperText=""
                    selectedSourceId={selectedSourceId}
                />

                <section className="pt-2">
                    <div className="mb-2 px-2 text-xs font-semibold text-(--text-primary)/70">
                        보관함
                    </div>
                    <div className="space-y-0.5">
                        <Link
                            href="/playlists"
                            className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--text-secondary) hover:bg-(--surface-raised)/70 hover:text-(--text-primary)"
                        >
                            <ListMusic size={15} className="text-(--notion-fg)/60" />
                            내 플레이리스트
                        </Link>
                        <Link
                            href="/bookmarks"
                            className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--text-secondary) hover:bg-(--surface-raised)/70 hover:text-(--text-primary)"
                        >
                            <Bookmark size={15} className="text-(--notion-fg)/60" />
                            북마크
                        </Link>
                        <Link
                            href="/teams"
                            className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--text-secondary) hover:bg-(--surface-raised)/70 hover:text-(--text-primary)"
                        >
                            <Users size={15} className="text-(--notion-fg)/60" />
                            팀
                        </Link>
                    </div>
                </section>

            </nav>

            <div className={`shrink-0 bg-(--surface-subtle)/90 px-3 pt-2 backdrop-blur ${playerActive ? "pb-24" : "pb-3"}`}>
                <div className="mb-1 px-1">
                    <LoginButton />
                </div>
                <ThemeToggle />
                <div className="flex gap-3 px-1 pt-1 text-xs font-medium text-(--text-primary)/70">
                    <Link href="/pricing" className="hover:text-(--text-primary)">요금제</Link>
                    <Link href="/landing" className="hover:text-(--text-primary)">소개</Link>
                </div>
            </div>
        </aside>
    );
}

function SidebarSection({
    title,
    items,
    icon,
    statusLabel,
    statusTone,
    helperText,
    muted = false,
    selectedSourceId,
    linkParam = "source",
    showAddChannel = false,
}: {
    title: string;
    items: Array<{ id: string; name: string }>;
    icon: React.ReactNode;
    statusLabel: string;
    statusTone: string;
    helperText: string;
    muted?: boolean;
    selectedSourceId?: string;
    linkParam?: "source" | "category";
    showAddChannel?: boolean;
}) {
    const query = linkParam === "category"
        ? (id: string) => (id ? { category: id } : {})
        : (id: string) => ({ source: id });
    return (
        <section>
            <div className="mb-2 flex items-center justify-between gap-2 px-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-(--text-primary)/70">
                    {icon}
                    <span>{title}</span>
                </div>
                {statusLabel ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}>
                        {statusLabel}
                    </span>
                ) : null}
            </div>

            {helperText ? (
                <div className="mb-2 px-2 text-xs leading-relaxed text-(--text-secondary)">
                    {helperText}
                </div>
            ) : null}

            <div className="space-y-1">
                {items.map((item) => {
                    const isActive = selectedSourceId === item.id;
                    return (
                        <Link
                            key={item.id}
                            href={{ pathname: "/", query: query(item.id) }}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${isActive ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : muted ? "text-(--notion-fg)/45 hover:bg-(--notion-hover)/60" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
                        >
                            <div className="flex w-4 justify-center">
                                <div className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-(--notion-fg)/60" : muted ? "bg-(--notion-fg)/20" : "bg-(--notion-fg)/30"}`} />
                            </div>
                            <span className="truncate">{item.name}</span>
                        </Link>
                    );
                })}
                {showAddChannel ? <AddChannelButton /> : null}
            </div>
        </section>
    );
}
