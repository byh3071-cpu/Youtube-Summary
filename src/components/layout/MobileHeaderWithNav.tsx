"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";
import { useTheme } from "next-themes";
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
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-(--notion-border) bg-(--notion-bg)/92 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-(--notion-fg)/70 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
            aria-label="메뉴 열기"
          >
            <Menu size={20} />
          </button>
          <div className="flex min-w-0 flex-1 justify-center">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-transparent"
                aria-label="테마 전환"
              >
                <Image
                  src="/focus-feed-logo-v2.png"
                  alt="Focus Feed 로고"
                  fill
                  sizes="40px"
                  className="object-contain"
                  priority
                />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">Focus Feed</p>
                <p className="truncate text-[11px] text-(--notion-fg)/55">
                  유튜브·RSS를 한곳에서
                </p>
              </div>
            </div>
          </div>
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
