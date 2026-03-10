import Link from "next/link";
import { Home, Rss, Youtube } from "lucide-react";
import { defaultSources } from "@/lib/sources";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { MergedFeedResult } from "@/lib/feed";

const youtubeSources = defaultSources.filter((source) => source.type === "YouTube");
const rssSources = defaultSources.filter((source) => source.type === "RSS");

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

export default function Sidebar({
    sourceStatus,
    selectedSourceId,
}: {
    sourceStatus: MergedFeedResult["sourceStatus"];
    selectedSourceId?: string;
}) {
    return (
        <aside className="hidden w-72 shrink-0 border-r border-(--notion-border) bg-(--notion-gray) md:flex md:flex-col">
            <div className="m-2 rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4">
                <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-(--notion-fg) text-xs font-bold text-(--notion-bg)">
                        F
                    </div>
                    <div>
                        <p className="text-sm font-semibold">Focus Feed</p>
                        <p className="text-xs text-(--notion-fg)/55">텍스트 중심 피드 워크스페이스</p>
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
                    title={`YouTube (${youtubeSources.length})`}
                    items={youtubeSources}
                    icon={<Youtube size={15} className="text-red-500" />}
                    statusLabel={youtubeStatusLabel[sourceStatus.youtube]}
                    statusTone={youtubeStatusTone[sourceStatus.youtube]}
                    muted={sourceStatus.youtube !== "ready"}
                    helperText={sourceStatus.youtube === "ready" ? "모든 YouTube 채널을 함께 표시합니다." : "현재 YouTube 소스는 일시적으로 피드에서 빠져 있습니다."}
                    selectedSourceId={selectedSourceId}
                />

                <SidebarSection
                    title={`RSS (${rssSources.length})`}
                    items={rssSources}
                    icon={<Rss size={15} className="text-blue-500" />}
                    statusLabel="표시 중"
                    statusTone="border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    helperText="RSS 소스는 현재 정상적으로 피드에 포함됩니다."
                    selectedSourceId={selectedSourceId}
                />
            </nav>

            <div className="flex flex-col gap-2 border-t border-(--notion-border) p-4">
                <ThemeToggle />
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
}: {
    title: string;
    items: typeof defaultSources;
    icon: React.ReactNode;
    statusLabel: string;
    statusTone: string;
    helperText: string;
    muted?: boolean;
    selectedSourceId?: string;
}) {
    return (
        <section>
            <div className="mb-2 flex items-center justify-between gap-2 px-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
                    {icon}
                    <span>{title}</span>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}>
                    {statusLabel}
                </span>
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
                        href={{ pathname: "/", query: { source: item.id } }}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${isActive ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : muted ? "text-(--notion-fg)/45 hover:bg-(--notion-hover)/60" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
                    >
                        <div className="flex w-4 justify-center">
                            <div className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-(--notion-fg)/60" : muted ? "bg-(--notion-fg)/20" : "bg-(--notion-fg)/30"}`} />
                        </div>
                        <span className="truncate">{item.name}</span>
                    </Link>
                )})}
            </div>
        </section>
    );
}
