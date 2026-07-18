import React from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main
      className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl flex-1 flex-col gap-5 px-3 pb-24 pt-4 sm:px-4 md:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Focus Feed 불러오는 중"
    >
      <div role="status" className="flex items-center justify-between rounded-2xl bg-(--surface-subtle) px-4 py-3 text-(--text-secondary)">
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative h-8 w-[108px] shrink-0 overflow-hidden">
            <Image src="/rogo.png" alt="Focus Feed" fill sizes="108px" className="object-cover object-left dark:hidden" priority />
            <Image src="/rogo-dark.png" alt="Focus Feed" fill sizes="108px" className="hidden object-cover object-left dark:block" priority />
          </span>
          <span className="truncate text-xs font-semibold sm:text-sm">새로운 피드를 준비하고 있어요</span>
        </span>
        <Loader2 size={18} className="shrink-0 animate-spin text-(--playback-accent)" aria-hidden />
      </div>
      <section className="mb-2 animate-pulse rounded-3xl border border-(--notion-border) bg-linear-to-b from-(--notion-bg) to-(--notion-gray) p-5 sm:mb-3 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-5 w-24 rounded-full bg-(--notion-gray)" />
            <div className="h-8 w-48 rounded-lg bg-(--notion-gray)" />
            <div className="flex gap-2">
              <div className="h-7 w-20 rounded-full bg-(--notion-gray)" />
              <div className="h-7 w-32 rounded-full bg-(--notion-gray)" />
            </div>
          </div>
          <div className="hidden gap-2 sm:flex">
            <div className="h-9 w-24 rounded-full bg-(--notion-gray)" />
            <div className="h-9 w-9 rounded-full bg-(--notion-gray)" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="h-9 w-full max-w-xl animate-pulse rounded-2xl border border-(--notion-border) bg-(--notion-gray)" />
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="flex animate-pulse flex-col overflow-hidden rounded-xl border border-(--notion-border) bg-(--notion-bg)"
            >
              <div className="aspect-video w-full bg-(--notion-gray)" />
              <div className="space-y-2 px-3 py-3">
                <div className="h-3 w-10/12 rounded bg-(--notion-gray)" />
                <div className="h-3 w-8/12 rounded bg-(--notion-gray)" />
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-6 w-6 rounded-full bg-(--notion-gray)" />
                  <div className="h-3 w-6/12 rounded bg-(--notion-gray)" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

