"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import { storage } from "@/lib/storage";

function normalizeKeyword(keyword: string): string {
  return keyword.trim().replace(/\s+/g, " ");
}

import type { FeedCategory } from "@/types/feed";
import { FEED_CATEGORIES } from "@/lib/sources";

export function useKeywordFilter() {
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    const prefs = storage.getPreferences();
    if (JSON.stringify(prefs.keywords) !== JSON.stringify(keywords)) {
      setKeywords(prefs.keywords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addKeyword = (newKeyword: string) => {
    const normalizedKeyword = normalizeKeyword(newKeyword);
    if (!normalizedKeyword) return;
    storage.addKeyword(normalizedKeyword);
    setKeywords(storage.getPreferences().keywords);
  };

  const removeKeyword = (keyword: string) => {
    storage.removeKeyword(keyword);
    setKeywords(storage.getPreferences().keywords);
  };

  const clearKeywords = () => {
    keywords.forEach((keyword) => storage.removeKeyword(keyword));
    setKeywords([]);
  };

  return { keywords, addKeyword, removeKeyword, clearKeywords };
}

interface KeywordFilterProps {
  selectedSourceName?: string;
  filteredItemsCount: number;
  keywords: string[];
  onAddKeyword: (kw: string) => void;
  onRemoveKeyword: (kw: string) => void;
  onClearKeywords: () => void;
  hasCategoryFilter?: boolean;
  selectedCategory?: FeedCategory | null;
  onCategoryChange?: (category: FeedCategory | null) => void;
  /** 보기 전환(전체/유튜브/RSS)과 함께 표시할 때 설명·여백 축소 */
  compact?: boolean;
  /** 헤더 오른쪽에 추가로 표시할 컴포넌트 (예: 보기 전환 버튼) */
  headerRight?: ReactNode;
}

export default function KeywordFilter({
  selectedSourceName,
  filteredItemsCount,
  keywords,
  onAddKeyword,
  onRemoveKeyword,
  onClearKeywords,
  hasCategoryFilter,
  selectedCategory,
  onCategoryChange,
  compact = false,
  headerRight,
}: KeywordFilterProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const hasActiveFilters = keywords.length > 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddKeyword(newKeyword);
    setNewKeyword("");
    setIsAdding(false);
  };

  const handleCancelAdd = () => {
    setNewKeyword("");
    setIsAdding(false);
  };

  return (
    <section className={compact ? "mb-4 rounded-xl border border-(--notion-border) bg-(--notion-bg) p-3 sm:p-4" : "mb-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-4 sm:mb-5"}>
      <div className={compact ? "mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" : "mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className={compact ? "mt-0 mb-0 text-sm font-semibold" : "mt-0 mb-1 text-base font-semibold"}>필터와 결과</h2>
            {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
          </div>
          {!compact && (
            <p className="text-sm text-(--notion-fg)/55">
              {selectedSourceName
                ? `${selectedSourceName} 안에서 키워드로 다시 좁혀볼 수 있습니다.`
                : "키워드를 등록하면 제목, 요약, 출처 이름 기준으로 피드를 빠르게 좁혀볼 수 있습니다."}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-(--notion-fg)/60">
          <span>표시 중인 항목 {filteredItemsCount}개</span>
          {hasActiveFilters && <span>· 활성 필터 {keywords.length}개</span>}
          {hasCategoryFilter && <span>· 카테고리 {selectedCategory}</span>}
        </div>
      </div>

      {onCategoryChange && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-(--notion-fg)/55">카테고리</span>
            <button
                type="button"
                onClick={() => onCategoryChange(null)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${!selectedCategory ? "border-(--notion-fg)/40 bg-(--notion-hover) text-(--notion-fg)" : "border-(--notion-border) text-(--notion-fg)/60 hover:bg-(--notion-hover)"}`}
            >
                전체
            </button>
            {FEED_CATEGORIES.map((cat) => (
                <button
                    key={cat}
                    type="button"
                    onClick={() => onCategoryChange(cat)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${selectedCategory === cat ? "border-(--notion-fg)/40 bg-(--notion-hover) text-(--notion-fg)" : "border-(--notion-border) text-(--notion-fg)/60 hover:bg-(--notion-hover)"}`}
                >
                    {cat}
                </button>
            ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {keywords.map(keyword => (
          <div
            key={keyword}
            className="flex items-center gap-1 rounded-full bg-(--notion-hover) px-2.5 py-1 text-xs font-semibold"
          >
            <span># {keyword}</span>
            <button
              type="button"
              onClick={() => onRemoveKeyword(keyword)}
              aria-label={`${keyword} 필터 제거`}
              className="rounded-full p-0.5 text-(--notion-fg)/40 hover:bg-(--notion-gray) hover:text-(--notion-fg)"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {isAdding ? (
          <form onSubmit={handleAddSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              autoFocus
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  handleCancelAdd();
                }
              }}
              placeholder="관심 키워드를 입력하세요"
              aria-label="관심 키워드 입력"
              className="w-48 rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1.5 text-sm font-medium focus:border-(--notion-fg)/30 focus:outline-none"
            />

            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-full bg-(--notion-fg) px-3 py-1.5 text-xs font-semibold text-(--notion-bg) transition-opacity hover:opacity-90"
            >
              <Check size={12} />
              저장
            </button>

            <button
              type="button"
              onClick={handleCancelAdd}
              className="rounded-full border border-(--notion-border) px-3 py-1.5 text-xs font-semibold text-(--notion-fg)/70 transition-colors hover:bg-(--notion-hover)"
            >
              취소
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-(--notion-border) px-3 py-1.5 text-xs font-semibold text-(--notion-fg)/50 transition-colors hover:bg-(--notion-hover)"
          >
            <Plus size={12} />
            <span>키워드 추가</span>
          </button>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearKeywords}
            className="rounded-full px-2 py-1 text-xs font-semibold text-(--notion-fg)/45 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
          >
            전체 해제
          </button>
        )}
      </div>

      {!compact && !hasActiveFilters && !isAdding && (
        <p className="mt-3 text-xs leading-relaxed text-(--notion-fg)/45">
          예시: `AI`, `생산성`, `개발`, `자동화`
        </p>
      )}
      {!compact && (
        <p className="mt-2 text-[11px] text-(--notion-fg)/40">
          키워드 필터는 이 기기·이 브라우저에만 저장됩니다.
        </p>
      )}
    </section>
  );
}
