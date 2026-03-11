import { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import MobileHeaderWithNav from "@/components/layout/MobileHeaderWithNav";
import FloatingRadioPlayer from "@/components/player/FloatingRadioPlayer";
import ScrollToTop from "@/components/ui/ScrollToTop";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

interface LayoutProps {
    children: ReactNode;
    sourceStatus: MergedFeedResult["sourceStatus"];
    selectedSourceId?: string;
    selectedCategory?: string;
    youtubeSources?: FeedSource[];
    customYouTubeSourceIds?: string[];
    latestVideoBySource?: Record<string, string>;
}

export default function AppLayout({ children, sourceStatus, selectedSourceId, selectedCategory, youtubeSources, customYouTubeSourceIds, latestVideoBySource }: LayoutProps) {
    return (
        <div className="flex min-h-screen flex-col bg-(--notion-bg) text-(--notion-fg) md:flex-row">
            <MobileHeaderWithNav
                sourceStatus={sourceStatus}
                selectedSourceId={selectedSourceId}
                selectedCategory={selectedCategory}
                youtubeSources={youtubeSources}
            />

            <Sidebar
                sourceStatus={sourceStatus}
                selectedSourceId={selectedSourceId}
                selectedCategory={selectedCategory}
                youtubeSources={youtubeSources}
                customYouTubeSourceIds={customYouTubeSourceIds}
                latestVideoBySource={latestVideoBySource}
            />

            <main className="min-w-0 flex-1 px-4 py-4 pb-28 sm:px-6 sm:py-6 sm:pb-32 md:px-10 lg:px-16">
                <div className="mx-auto max-w-5xl">
                    {children}
                </div>
            </main>

            <FloatingRadioPlayer />
            <ScrollToTop />
        </div>
    );
}
