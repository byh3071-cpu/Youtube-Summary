"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain } from "lucide-react";
import {
  KNOWLEDGE_JOBS_CHANGED_EVENT,
  knowledgeJobIsOpen,
  type KnowledgeJobSummary,
} from "@/lib/knowledge-capture";

export function useKnowledgeOpenJobCount() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let latestRequest = 0;
    const refresh = async () => {
      const request = ++latestRequest;
      try {
        const response = await fetch("/api/knowledge/jobs", { cache: "no-store" });
        const data = response.ok
          ? await response.json() as { jobs?: KnowledgeJobSummary[] }
          : null;
        if (!cancelled && request === latestRequest && data) {
          setActive((data.jobs ?? []).filter((job) => knowledgeJobIsOpen(job.status)).length);
        }
      } catch {
        // Navigation remains usable when the optional queue migration is unavailable.
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(KNOWLEDGE_JOBS_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      window.removeEventListener(KNOWLEDGE_JOBS_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return active;
}

export default function KnowledgeNavLink({
  mobile = false,
  onClick,
}: {
  mobile?: boolean;
  onClick?: () => void;
}) {
  const active = useKnowledgeOpenJobCount();
  return <Link href="/knowledge" onClick={onClick} className={mobile ? "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-(--text-secondary) hover:bg-(--surface-subtle) hover:text-(--text-primary)" : "flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--text-secondary) hover:bg-(--surface-raised)/70 hover:text-(--text-primary)"}><Brain size={mobile ? 18 : 15} className="shrink-0" />지식함{active > 0 && <span className="ml-auto rounded-full bg-(--notion-fg) px-2 py-0.5 text-[11px] font-bold text-(--notion-bg)" aria-label={`열린 작업 ${active}개`}>{active > 99 ? "99+" : active}</span>}</Link>;
}
