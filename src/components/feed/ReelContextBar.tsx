"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const MODE_LABEL: Record<"longform" | "shortform" | "live", string> = {
  longform: "동영상",
  shortform: "숏폼",
  live: "라이브",
};

export default function ReelContextBar({
  viewMode,
}: {
  viewMode: "longform" | "shortform" | "live";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const exitHref = useMemo(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("viewMode");
    params.delete("watch");
    const q = params.toString();
    const base = pathname && pathname.length > 0 ? pathname : "/";
    return q ? `${base}?${q}` : base;
  }, [pathname, searchParams]);

  return (
    <header
      aria-label={`${MODE_LABEL[viewMode]} 리얼 피드`}
      data-testid="reel-context-bar"
      className="relative z-30 grid h-14 shrink-0 grid-cols-3 items-center gap-2 overflow-hidden bg-black px-2 text-white sm:h-12 sm:px-4"
    >
      <Link
        href={exitHref}
        className="inline-flex h-12 min-h-12 min-w-[5.25rem] touch-manipulation items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold text-white transition-colors hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:h-10 sm:min-h-10"
        aria-label={`${MODE_LABEL[viewMode]} 종료하고 홈으로 이동`}
      >
        <ArrowLeft size={20} strokeWidth={2.4} aria-hidden />
        홈
      </Link>
      <h1 data-testid="reel-context-title" className="m-0! text-center text-xs! font-semibold leading-none! text-white sm:text-sm!">
        {MODE_LABEL[viewMode]}
      </h1>
      <span aria-hidden />
    </header>
  );
}
