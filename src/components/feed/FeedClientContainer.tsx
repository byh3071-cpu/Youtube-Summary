"use client";

import { useState, useEffect } from "react";
import { FeedItem } from "@/types/feed";
import { storage } from "@/lib/storage";
import { filterFeedByKeywords } from "@/lib/filter";
import FeedList from "./FeedList"; // Force IDE TS-Server refresh
import { Check, Plus, X } from "lucide-react";

function normalizeKeyword(keyword: string): string {
    return keyword.trim().replace(/\s+/g, " ");
}

export default function FeedClientContainer({
    initialItems,
    selectedSourceName,
}: {
    initialItems: FeedItem[];
    selectedSourceName?: string;
}) {
    // 클라이언트 마운트 시 저장소에서 키워드 바로 초기화 (useEffect 내 setState 방지)
    const [keywords, setKeywords] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newKeyword, setNewKeyword] = useState("");

    useEffect(() => {
        // 하이드레이션 이후에만 localStorage 접근하도록 수정
        const prefs = storage.getPreferences();
        if (JSON.stringify(prefs.keywords) !== JSON.stringify(keywords)) {
            setKeywords(prefs.keywords);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAddKeyword = (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedKeyword = normalizeKeyword(newKeyword);

        if (!normalizedKeyword) {
            return;
        }

        storage.addKeyword(normalizedKeyword);
        setKeywords(storage.getPreferences().keywords);
        setNewKeyword("");
        setIsAdding(false);
    };

    const handleRemoveKeyword = (keyword: string) => {
        storage.removeKeyword(keyword);
        setKeywords(storage.getPreferences().keywords);
    };

    const handleCancelAdd = () => {
        setNewKeyword("");
        setIsAdding(false);
    };

    // 필터 적용
    const filteredItems = filterFeedByKeywords(initialItems, keywords);
    const hasActiveFilters = keywords.length > 0;

    return (
        <>
            <section className="mb-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-4 sm:mb-5">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="mt-0 mb-1 text-base font-semibold">필터와 결과</h2>
                        <p className="text-sm text-(--notion-fg)/55">
                            {selectedSourceName
                                ? `${selectedSourceName} 안에서 키워드로 다시 좁혀볼 수 있습니다.`
                                : "키워드를 등록하면 제목, 요약, 출처 이름 기준으로 피드를 빠르게 좁혀볼 수 있습니다."}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-(--notion-fg)/60">
                        <span>표시 중인 항목 {filteredItems.length}개</span>
                        {hasActiveFilters && <span>· 활성 필터 {keywords.length}개</span>}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {keywords.map(keyword => (
                        <div
                            key={keyword}
                            className="flex items-center gap-1 rounded-full bg-(--notion-hover) px-2.5 py-1 text-xs font-semibold"
                        >
                            <span># {keyword}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveKeyword(keyword)}
                                aria-label={`${keyword} 필터 제거`}
                                className="rounded-full p-0.5 text-(--notion-fg)/40 hover:bg-(--notion-gray) hover:text-(--notion-fg)"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}

                    {isAdding ? (
                        <form onSubmit={handleAddKeyword} className="flex flex-wrap items-center gap-2">
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
                            <span>필터 추가</span>
                        </button>
                    )}

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={() => {
                                keywords.forEach((keyword) => storage.removeKeyword(keyword));
                                setKeywords([]);
                            }}
                            className="rounded-full px-2 py-1 text-xs font-semibold text-(--notion-fg)/45 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                        >
                            전체 해제
                        </button>
                    )}
                </div>

                {!hasActiveFilters && !isAdding && (
                    <p className="mt-3 text-xs leading-relaxed text-(--notion-fg)/45">
                        예시: `AI`, `생산성`, `개발`, `자동화`
                    </p>
                )}
            </section>

            <FeedList items={filteredItems} hasActiveFilters={hasActiveFilters} selectedSourceName={selectedSourceName} />
        </>
    );
}
