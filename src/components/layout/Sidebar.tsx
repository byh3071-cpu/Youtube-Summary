"use client";

import { Home, Settings, Search, Clock } from "lucide-react";

export default function Sidebar() {
    return (
        <aside className="w-64 flex-shrink-0 bg-[var(--notion-gray)] border-r border-[var(--notion-border)] flex flex-col hidden md:flex">
            {/* Workspace Header */}
            <div className="p-4 hover:bg-[var(--notion-hover)] cursor-pointer flex items-center gap-2 m-2 rounded-md transition-colors">
                <div className="w-5 h-5 bg-[var(--notion-fg)] text-[var(--notion-bg)] rounded flex items-center justify-center text-xs font-bold">
                    F
                </div>
                <span className="font-semibold text-sm">Focus Workspace</span>
            </div>

            <div className="px-3 mb-4">
                <button className="w-full flex items-center gap-2 text-sm text-[var(--notion-fg)]/70 hover:bg-[var(--notion-hover)] p-1.5 rounded-md transition-colors">
                    <Search size={16} />
                    <span>Search</span>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-0.5">
                <div className="text-xs font-semibold text-[var(--notion-fg)]/50 mb-2 px-2 mt-4">Favorites</div>
                <NavItem icon={<Home size={16} />} label="All Feeds" active />
                <NavItem icon={<Clock size={16} />} label="Read Later" />

                <div className="text-xs font-semibold text-[var(--notion-fg)]/50 mb-2 px-2 mt-6">Sources</div>
                <NavItem label="장피엠의 일잘러" isSource />
                <NavItem label="노마드 코더" isSource />
                <NavItem label="GeekNews" isSource />
            </nav>

            {/* Footer Settings */}
            <div className="p-3 border-t border-[var(--notion-border)]">
                <NavItem icon={<Settings size={16} />} label="Settings" />
            </div>
        </aside>
    );
}

function NavItem({ icon, label, active = false, isSource = false }: { icon?: React.ReactNode, label: string, active?: boolean, isSource?: boolean }) {
    return (
        <button
            className={`w-full flex items-center gap-2 text-sm p-1.5 rounded-md transition-colors ${active ? 'bg-[var(--notion-hover)] font-medium' : 'hover:bg-[var(--notion-hover)] text-[var(--notion-fg)]/80'
                }`}
        >
            {isSource ? (
                <div className="w-4 flex justify-center"><div className="w-1.5 h-1.5 rounded-full bg-[var(--notion-fg)]/30" /></div>
            ) : (
                <span className="opacity-70">{icon}</span>
            )}
            <span className="truncate">{label}</span>
        </button>
    );
}
