"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

const SHOW_AFTER = 400;

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-24 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-(--notion-border) bg-(--notion-bg) shadow-lg text-(--notion-fg)/70 hover:bg-(--notion-hover) hover:text-(--notion-fg) md:bottom-28 md:right-6"
      aria-label="맨 위로"
      title="맨 위로"
    >
      <ArrowUp size={18} />
    </button>
  );
}
