import { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";

interface LayoutProps {
    children: ReactNode;
}

export default function AppLayout({ children }: LayoutProps) {
    return (
        <div className="flex min-h-screen bg-(--notion-bg) text-(--notion-fg)">
            {/* Sidebar */}
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
