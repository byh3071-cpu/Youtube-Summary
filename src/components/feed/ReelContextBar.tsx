"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";

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
  const exitHref = pathname && pathname.length > 0 ? pathname : "/";

  return (
    <header
      aria-label={`${MODE_LABEL[viewMode]} 리얼 피드`}
      data-testid="reel-context-bar"
      className="relative z-50 flex h-16 shrink-0 items-center overflow-hidden bg-black pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] text-white sm:h-14"
    >
      <Link
        href={exitHref}
        replace
        prefetch
        data-testid="reel-home-link"
        className="relative z-10 inline-flex h-[52px] min-h-[52px] min-w-[6.75rem] touch-manipulation items-center justify-start gap-2 rounded-full bg-white/10 px-4 text-base font-bold text-white transition-colors hover:bg-white/16 active:bg-white/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:h-12 sm:min-h-12"
        aria-label={`${MODE_LABEL[viewMode]} 종료하고 홈으로 이동`}
      >
        <ArrowLeft size={24} strokeWidth={2.5} aria-hidden />
        홈
      </Link>
      <h1 data-testid="reel-context-title" className="pointer-events-none absolute left-1/2 m-0! -translate-x-1/2 text-center text-sm! font-semibold leading-none! text-white sm:text-base!">
        {MODE_LABEL[viewMode]}
      </h1>
    </header>
  );
}
