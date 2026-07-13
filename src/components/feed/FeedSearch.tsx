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

  // 짧은 지연으로 빠른 타이핑 중 불필요한 재필터링만 합친다.
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(input);
    }, 50);
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
        data-testid="feed-search-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="제목, 채널, 키워드 검색"
        aria-label="피드 검색"
        className="h-12 w-full rounded-xl border border-(--border-subtle) bg-(--surface-raised) py-3 pl-11 pr-11 text-sm text-(--text-primary) shadow-[var(--shadow-xs)] outline-none transition-[border-color,box-shadow] placeholder:text-(--text-secondary)/65 focus:border-(--ai-accent)/40 focus:shadow-[0_0_0_3px_var(--ai-accent-muted)]"
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
