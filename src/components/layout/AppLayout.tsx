import { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { MergedFeedResult } from "@/lib/feed";

interface LayoutProps {
    children: ReactNode;
    sourceStatus: MergedFeedResult["sourceStatus"];
    selectedSourceId?: string;
}

export default function AppLayout({ children, sourceStatus, selectedSourceId }: LayoutProps) {
    return (
        <div className="flex min-h-screen flex-col bg-(--notion-bg) text-(--notion-fg) md:flex-row">
            {/* Mobile Header */}
            <header className="sticky top-0 z-20 border-b border-(--notion-border) bg-(--notion-bg)/92 px-4 py-3 backdrop-blur md:hidden">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded bg-(--notion-fg) text-xs font-bold text-(--notion-bg)">
                        F
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold">Focus Feed</p>
                            <p className="truncate text-xs text-(--notion-fg)/55">
                                유튜브와 RSS를 한 곳에서 읽는 개인 피드
                            </p>
                        </div>
                    </div>

                    <ThemeToggle iconOnly />
                </div>
            </header>

            {/* Sidebar (Desktop only) */}
            <Sidebar sourceStatus={sourceStatus} selectedSourceId={selectedSourceId} />

            {/* Main Content Area */}
            <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 md:px-10 lg:px-16">
                <div className="mx-auto max-w-5xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
