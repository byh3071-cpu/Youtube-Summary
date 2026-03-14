"use client";

import { useState } from "react";
import Image from "next/image";
import { LoginButton } from "@/components/auth/LoginButton";
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
      <header className="sticky top-0 z-20 border-b border-(--notion-border) bg-(--notion-bg)/92 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative flex h-11 shrink-0 items-center justify-center rounded-lg text-(--notion-fg)/70 hover:bg-(--notion-hover) hover:text-(--notion-fg) w-[150px]"
            aria-label="메뉴 열기"
          >
            <Image
              src="/rogo.png"
              alt="Focus Feed"
              width={150}
              height={44}
              className="object-contain object-left"
              priority
            />
          </button>
          <div className="min-w-0 flex-1" aria-hidden />
          <div className="flex items-center gap-2">
            <LoginButton />
          </div>
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
