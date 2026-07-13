"use client";

import { Youtube, Rss, LayoutGrid } from "lucide-react";

export type ViewMode = "all" | "youtube" | "rss";

const VIEWS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "전체", icon: <LayoutGrid size={14} /> },
  { id: "youtube", label: "유튜브", icon: <Youtube size={14} className="text-red-500" /> },
  { id: "rss", label: "RSS", icon: <Rss size={14} className="text-blue-500" /> },
];

interface Props {
  currentView: ViewMode;
  onChange: (view: ViewMode) => void;
}

export default function ViewSwitcher({ currentView, onChange }: Props) {

  return (
    // 360px 등 좁은 화면에서 글자가 세로로 깨지지 않도록 가로 스크롤 허용
    <div data-testid="view-switcher" className="flex min-w-0 items-center overflow-x-auto">
      <div className="flex shrink-0 gap-1">
        {VIEWS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            data-testid={`view-${id}`}
            onClick={() => onChange(id)}
            aria-pressed={currentView === id}
            className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] touch-manipulation sm:min-h-10 ${
              currentView === id
                ? "bg-(--text-primary) text-(--surface-raised) shadow-sm"
                : "text-(--text-secondary) hover:bg-(--surface-subtle) hover:text-(--text-primary)"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
