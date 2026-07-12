"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

type FeedSearchProps = {
  value: string;
  onChange: (query: string) => void;
};

export default function FeedSearch({ value, onChange }: FeedSearchProps) {
  const [input, setInput] = useState(value);

  // Sync external value changes
  useEffect(() => {
    setInput(value);
  }, [value]);

  // Debounce: propagate after 300ms of inactivity
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(input);
    }, 300);
    return () => clearTimeout(timer);
  }, [input, onChange]);

  return (
    <div className="group relative w-full">
      <Search
        size={19}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--notion-fg)/40 transition-colors group-focus-within:text-(--notion-fg)/70"
      />
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="제목, 채널, 키워드 검색"
        aria-label="피드 검색"
        className="h-12 w-full rounded-2xl border border-(--notion-border) bg-(--notion-bg) py-3 pl-11 pr-11 text-sm text-(--notion-fg) shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-[border-color,box-shadow] placeholder:text-(--notion-fg)/40 focus:border-(--notion-fg)/30 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.10)]"
      />
      {input && (
        <button
          type="button"
          onClick={() => {
            setInput("");
            onChange("");
          }}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-(--notion-fg)/45 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          aria-label="검색어 지우기"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
