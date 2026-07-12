"use client";

import { Youtube, Rss, LayoutGrid } from "lucide-react";

export type ViewMode = "all" | "youtube" | "rss";

const VIEWS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "전체(최신순)", icon: <LayoutGrid size={14} /> },
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
    <div className="flex min-w-0 items-center overflow-x-auto">
      <div className="flex shrink-0 rounded-xl bg-(--notion-gray)/55 p-1">
        {VIEWS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={currentView === id}
            className={`flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-[background-color,color,box-shadow] touch-manipulation sm:min-h-0 ${
              currentView === id
                ? "bg-(--notion-bg) text-(--notion-fg) shadow-sm"
                : "text-(--notion-fg)/60 hover:bg-(--notion-hover)/60 hover:text-(--notion-fg)"
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
