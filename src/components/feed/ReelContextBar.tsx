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
    const q = params.toString();
    const base = pathname && pathname.length > 0 ? pathname : "/";
    return q ? `${base}?${q}` : base;
  }, [pathname, searchParams]);

  return (
    <header
      aria-label={`${MODE_LABEL[viewMode]} 리얼 피드`}
      data-testid="reel-context-bar"
      className="relative z-10 grid h-12 shrink-0 grid-cols-3 items-center gap-2 overflow-hidden bg-black px-3 text-white sm:px-4"
    >
      <Link
        href={exitHref}
        className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:text-sm"
      >
        <ArrowLeft size={16} aria-hidden />
        홈
      </Link>
      <h1 data-testid="reel-context-title" className="m-0! text-center text-xs! font-semibold leading-none! text-white sm:text-sm!">
        {MODE_LABEL[viewMode]}
      </h1>
      <span aria-hidden />
    </header>
  );
}
