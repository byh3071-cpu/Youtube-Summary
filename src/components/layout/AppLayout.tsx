import { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface LayoutProps {
    children: ReactNode;
}

export default function AppLayout({ children }: LayoutProps) {
    return (
        <div className="flex min-h-screen flex-col bg-(--notion-bg) text-(--notion-fg) md:flex-row">
            {/* Mobile Header */}
            <header className="flex h-14 items-center justify-between border-b border-(--notion-border) bg-(--notion-bg) px-4 md:hidden">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-(--notion-fg) text-xs font-bold text-(--notion-bg)">
                        F
                    </div>
                    <span className="font-semibold">Focus Feed</span>
                </div>
                <ThemeToggle iconOnly={true} />
            </header>

            {/* Sidebar (Desktop only) */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-10 lg:px-16">
                <div className="mx-auto max-w-4xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
