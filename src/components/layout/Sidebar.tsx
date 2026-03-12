 "use client";

import Link from "next/link";
import Image from "next/image";
import { Home, Rss, Youtube, Tag, Bookmark, ListMusic } from "lucide-react";
import { useTheme } from "next-themes";
import { defaultSources, FEED_CATEGORIES } from "@/lib/sources";
import { LoginButton } from "@/components/auth/LoginButton";
import AddChannelButton from "@/components/feed/AddChannelButton";
import SourceExportImport from "@/components/feed/SourceExportImport";
import YouTubeSourceList from "@/components/layout/YouTubeSourceList";
import { YOUTUBE_STATUS_LABEL, YOUTUBE_STATUS_TONE } from "@/lib/youtube-status";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

const rssSources = defaultSources.filter((source) => source.type === "RSS");

export default function Sidebar({
    sourceStatus,
    selectedSourceId,
    selectedCategory,
    youtubeSources: youtubeSourcesProp,
    customYouTubeSourceIds = [],
    latestVideoBySource,
}: {
    sourceStatus: MergedFeedResult["sourceStatus"];
    selectedSourceId?: string;
    selectedCategory?: string;
    youtubeSources?: FeedSource[];
    customYouTubeSourceIds?: string[];
    latestVideoBySource?: Record<string, string>;
}) {
    const youtubeSources = youtubeSourcesProp ?? defaultSources.filter((s) => s.type === "YouTube");
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";
    return (
        <aside className="hidden w-72 shrink-0 border-r border-(--notion-border) bg-(--notion-gray) md:flex md:flex-col">
            <div className="m-2 rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4">
                <div className="mb-4 flex flex-col items-center gap-4">
                    <button
                        type="button"
                        onClick={() => setTheme(isDark ? "light" : "dark")}
                        className="relative h-20 w-20 overflow-hidden rounded-3xl bg-transparent"
                        aria-label="테마 전환"
                    >
                        <Image
                            src="/focus-feed-logo-v2.png"
                            alt="Focus Feed 로고"
                            fill
                            sizes="80px"
                            className="object-contain"
                        />
                    </button>
                    <div className="flex items-center justify-center gap-2">
                        <LoginButton />
                    </div>
                </div>

                <Link
                    href="/"
                    className={`block rounded-lg px-3 py-2 transition-colors ${selectedSourceId ? "hover:bg-(--notion-hover)" : "bg-(--notion-hover)"}`}
                >
                    <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                        <Home size={15} />
                        <span>전체 피드</span>
                    </div>
                    <p className="text-xs leading-relaxed text-(--notion-fg)/60">
                        유튜브와 RSS를 한 곳에서 모아 최신순으로 확인합니다.
                    </p>
                </Link>
            </div>

            <nav className="flex-1 space-y-6 px-3 py-2">
                <SidebarSection
                    title="카테고리"
                    items={[{ id: "", name: "전체" }, ...FEED_CATEGORIES.map((id) => ({ id, name: id }))]}
                    icon={<Tag size={15} className="text-(--notion-fg)/60" />}
                    statusLabel=""
                    statusTone=""
                    helperText="AI·자기계발·개발·뉴스 등으로 필터합니다."
                    selectedSourceId={selectedCategory ?? ""}
                    linkParam="category"
                />

                <section>
                    <div className="mb-2 flex items-center justify-between gap-2 px-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
                            <Youtube size={15} className="text-red-500" />
                            <span>YouTube ({youtubeSources.length})</span>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${YOUTUBE_STATUS_TONE[sourceStatus.youtube]}`}>
                            {YOUTUBE_STATUS_LABEL[sourceStatus.youtube]}
                        </span>
                    </div>
                    <div className="mb-2 px-2 text-xs leading-relaxed text-(--notion-fg)/45">
                        {sourceStatus.youtube === "ready" ? "모든 YouTube 채널을 함께 표시합니다." : "현재 YouTube 소스는 일시적으로 피드에서 빠져 있습니다."}
                    </div>
                    <YouTubeSourceList
                        items={youtubeSources}
                        selectedSourceId={selectedSourceId}
                        customSourceIds={customYouTubeSourceIds}
                        latestVideoBySource={latestVideoBySource}
                    />
                    <AddChannelButton />
                    <SourceExportImport />
                </section>

                <SidebarSection
                    title={`RSS (${rssSources.length})`}
                    items={rssSources}
                    icon={<Rss size={15} className="text-blue-500" />}
                    statusLabel="표시 중"
                    statusTone="border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    helperText="RSS 소스는 현재 정상적으로 피드에 포함됩니다."
                    selectedSourceId={selectedSourceId}
                />

                <section className="pt-2">
                    <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
                        내 콘텐츠
                    </div>
                    <div className="space-y-0.5">
                        <Link
                            href="/playlists"
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-(--notion-fg)/80 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                        >
                            <ListMusic size={15} className="text-(--notion-fg)/60" />
                            내 플레이리스트
                        </Link>
                        <Link
                            href="/bookmarks"
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-(--notion-fg)/80 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                        >
                            <Bookmark size={15} className="text-(--notion-fg)/60" />
                            북마크
                        </Link>
                    </div>
                </section>
            </nav>

            <div className="flex flex-col gap-2 border-t border-(--notion-border) p-4 pb-28 md:pb-24">
                <div className="text-xs leading-relaxed text-(--notion-fg)/55">
                    새 기능은 검증이 끝난 뒤 순차적으로 추가합니다. 현재는 읽기와 필터링 경험에 집중합니다.
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
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
                    {icon}
                    <span>{title}</span>
                </div>
                {statusLabel ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}>
                        {statusLabel}
                    </span>
                ) : null}
            </div>

            <div className="mb-2 px-2 text-xs leading-relaxed text-(--notion-fg)/45">
                {helperText}
            </div>

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
