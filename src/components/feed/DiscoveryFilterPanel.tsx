"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, SlidersHorizontal, X } from "lucide-react";
import { ModalTransition } from "@/components/ui/ModalTransition";
import type { FeedCategory } from "@/types/feed";

interface Props {
  keywords: string[];
  onAddKeyword: (keyword: string) => void;
  onRemoveKeyword: (keyword: string) => void;
  onClearKeywords: () => void;
  selectedCategory: FeedCategory | null;
  onCategoryChange: (category: FeedCategory | null) => void;
  availableCategories: FeedCategory[];
}

export default function DiscoveryFilterPanel({
  keywords,
  onAddKeyword,
  onRemoveKeyword,
  onClearKeywords,
  selectedCategory,
  onCategoryChange,
  availableCategories,
}: Props) {
  const [open, setOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const activeCount = keywords.length + (selectedCategory ? 1 : 0);

  const submitKeyword = (event: React.FormEvent) => {
    event.preventDefault();
    const value = newKeyword.trim();
    if (!value) return;
    onAddKeyword(value);
    setNewKeyword("");
  };

  const panel = typeof document !== "undefined"
    ? createPortal(
        <ModalTransition
          open={open}
          onClose={() => setOpen(false)}
          overlayClassName="fixed inset-0 bg-black/25 backdrop-blur-[1px]"
          overlayZ={90}
          panelZ={91}
          variant="center"
          panelId="discovery-filter-panel"
          panelTestId="discovery-filter-panel"
          transitionDuration={0.12}
          exitDuration={0.06}
          panelRole="dialog"
          panelAriaLabel="상세 필터"
          panelClassName="scroll-lock-stable-right fixed inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-[24px] border border-(--border-subtle) bg-(--surface-raised) p-5 shadow-[0_-18px_60px_rgba(0,0,0,0.18)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[400px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:p-6 sm:shadow-[-18px_0_60px_rgba(0,0,0,0.14)]"
        >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-(--text-secondary)/25 sm:hidden" aria-hidden />
            <header className="flex items-start justify-between gap-4 border-b border-(--border-subtle) pb-4">
              <div>
                <div className="flex items-center gap-2 text-(--text-secondary)">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-[0.12em]">Feed controls</span>
                </div>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.025em] text-(--text-primary)">상세 필터</h2>
                <p className="mt-1 text-xs text-(--text-secondary)">관심 있는 주제만 남겨 피드의 밀도를 조절합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-(--text-secondary) transition-colors hover:bg-(--surface-subtle) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ai-accent)/35"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-7 py-5">
              <section aria-labelledby="filter-category-title">
                <h3 id="filter-category-title" className="text-sm font-bold text-(--text-primary)">카테고리</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onCategoryChange(null)}
                    aria-pressed={!selectedCategory}
                    className={`min-h-11 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${!selectedCategory ? "border-(--text-primary) bg-(--text-primary) text-(--surface-raised)" : "border-(--border-subtle) text-(--text-secondary) hover:bg-(--surface-subtle) hover:text-(--text-primary)"}`}
                  >
                    전체
                  </button>
                  {availableCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => onCategoryChange(category)}
                      aria-pressed={selectedCategory === category}
                      className={`min-h-11 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${selectedCategory === category ? "border-(--text-primary) bg-(--text-primary) text-(--surface-raised)" : "border-(--border-subtle) text-(--text-secondary) hover:bg-(--surface-subtle) hover:text-(--text-primary)"}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </section>

              <section aria-labelledby="filter-keyword-title">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="filter-keyword-title" className="text-sm font-bold text-(--text-primary)">관심 키워드</h3>
                  {keywords.length > 0 && (
                    <button type="button" onClick={onClearKeywords} className="text-xs font-semibold text-(--text-secondary) hover:text-(--text-primary)">
                      전체 해제
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <span key={keyword} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-(--surface-subtle) pl-3.5 pr-1.5 text-xs font-semibold text-(--text-primary)">
                      # {keyword}
                      <button type="button" onClick={() => onRemoveKeyword(keyword)} aria-label={`${keyword} 필터 제거`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-(--text-secondary) hover:bg-(--surface-raised) hover:text-(--text-primary)">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <form onSubmit={submitKeyword} className="mt-3 flex gap-2">
                  <label htmlFor="discovery-keyword-input" className="sr-only">관심 키워드 입력</label>
                  <input
                    id="discovery-keyword-input"
                    value={newKeyword}
                    onChange={(event) => setNewKeyword(event.target.value)}
                    placeholder="예: AI, 생산성, 자동화"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-(--border-subtle) bg-(--surface-raised) px-3 text-sm text-(--text-primary) outline-none placeholder:text-(--text-secondary)/65 focus:border-(--ai-accent)/45 focus:ring-2 focus:ring-(--ai-accent)/15"
                  />
                  <button type="submit" className="inline-flex h-11 items-center gap-1 rounded-xl bg-(--text-primary) px-3 text-xs font-bold text-(--surface-raised)">
                    {newKeyword.trim() ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    추가
                  </button>
                </form>
              </section>
            </div>
        </ModalTransition>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="필터 열기"
        aria-expanded={open}
        aria-controls="discovery-filter-panel"
        data-testid="discovery-filter-trigger"
        className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border border-(--border-subtle) bg-(--surface-raised) px-3.5 text-xs font-bold text-(--text-primary) shadow-[var(--shadow-xs)] transition-colors hover:bg-(--surface-subtle) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ai-accent)/25"
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">필터</span>
        {activeCount > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-(--ai-accent) px-1.5 py-0.5 text-[10px] text-white">{activeCount}</span>}
      </button>
      {panel}
    </>
  );
}
