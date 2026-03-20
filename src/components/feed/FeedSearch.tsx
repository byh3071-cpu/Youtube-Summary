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
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 480,
      }}
    >
      <Search
        size={18}
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--notion-secondary-text, #999)",
          pointerEvents: "none",
        }}
      />
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="피드 검색..."
        style={{
          width: "100%",
          padding: "10px 36px 10px 38px",
          borderRadius: 12,
          border: "1px solid var(--notion-border, #e0e0e0)",
          background: "var(--notion-bg, #fff)",
          color: "var(--notion-fg, #37352f)",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {input && (
        <button
          type="button"
          onClick={() => {
            setInput("");
            onChange("");
          }}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--notion-secondary-text, #999)",
          }}
          aria-label="검색어 지우기"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
