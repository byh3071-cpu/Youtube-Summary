import { ReactNode } from "react";
import Sidebar from "./Sidebar";

interface LayoutProps {
    children: ReactNode;
}

export default function AppLayout({ children }: LayoutProps) {
    return (
        <div className="flex h-screen overflow-hidden bg-[var(--notion-bg)] text-[var(--notion-fg)]">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto px-10 py-12 md:px-24">
                <div className="mx-auto max-w-4xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
