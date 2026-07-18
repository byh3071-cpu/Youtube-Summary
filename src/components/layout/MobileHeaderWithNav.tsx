"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import MobileNavDrawer from "./MobileNavDrawer";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

export default function MobileHeaderWithNav({
  sourceStatus,
  selectedSourceId,
  selectedCategory,
  youtubeSources,
}: {
  sourceStatus: MergedFeedResult["sourceStatus"];
  selectedSourceId?: string;
  selectedCategory?: string;
  youtubeSources?: FeedSource[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header data-testid="mobile-header" className="sticky top-0 z-50 h-16 border-b border-(--border-subtle) bg-(--surface-raised)/92 px-3 py-2 backdrop-blur-xl lg:hidden">
        <div className="flex h-full items-center">
          <div data-testid="mobile-brand-menu" className="relative h-10 w-[136px] shrink-0 overflow-visible">
            <Image src="/rogo.png" alt="" fill sizes="136px" className="pointer-events-none object-cover object-left dark:hidden" priority aria-hidden />
            <Image src="/rogo-dark.png" alt="" fill sizes="136px" className="pointer-events-none hidden object-cover object-left dark:block" priority aria-hidden />
            <button
              data-testid="brand-menu-trigger"
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="absolute top-1/2 left-0 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl hover:bg-(--surface-subtle)/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/45"
              aria-label="메뉴 열기"
              aria-expanded={drawerOpen}
              aria-controls="mobile-navigation-drawer"
            >
              <span className="sr-only">메뉴 열기</span>
            </button>
            <Link
              href="/"
              className="absolute inset-y-0 right-0 left-11 z-10 rounded-r-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--playback-accent)/45"
              aria-label="Focus Feed 홈"
            />
          </div>
          <div className="min-w-0 flex-1" aria-hidden />
        </div>
      </header>
      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sourceStatus={sourceStatus}
        selectedSourceId={selectedSourceId}
        selectedCategory={selectedCategory}
        youtubeSources={youtubeSources}
      />
    </>
  );
}
