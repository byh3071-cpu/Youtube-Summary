import { Home, Rss, Youtube } from "lucide-react";
import { defaultSources } from "@/lib/sources";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const youtubeSources = defaultSources.filter((source) => source.type === "YouTube");
const rssSources = defaultSources.filter((source) => source.type === "RSS");

export default function Sidebar() {
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

                <div className="rounded-lg bg-(--notion-hover) px-3 py-2">
                    <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                        <Home size={15} />
                        <span>전체 피드</span>
                    </div>
                    <p className="text-xs leading-relaxed text-(--notion-fg)/60">
                        유튜브와 RSS를 한 곳에서 모아 최신순으로 확인합니다.
                    </p>
                </div>
            </div>

            <nav className="flex-1 space-y-6 px-3 py-2">
                <SidebarSection
                    title={`YouTube (${youtubeSources.length})`}
                    items={youtubeSources.map((source) => source.name)}
                    icon={<Youtube size={15} className="text-red-500" />}
                />

                <SidebarSection
                    title={`RSS (${rssSources.length})`}
                    items={rssSources.map((source) => source.name)}
                    icon={<Rss size={15} className="text-blue-500" />}
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

function SidebarSection({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
    return (
        <section>
            <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
                {icon}
                <span>{title}</span>
            </div>

            <div className="space-y-1">
                {items.map((item) => (
                    <div
                        key={item}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--notion-fg)/80"
                    >
                        <div className="flex w-4 justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-(--notion-fg)/30" />
                        </div>
                        <span className="truncate">{item}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
