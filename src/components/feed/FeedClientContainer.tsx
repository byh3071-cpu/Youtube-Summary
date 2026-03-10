"use client";

import { useState, useEffect } from "react";
import { FeedItem } from "@/types/feed";
import { storage } from "@/lib/storage";
import { filterFeedByKeywords } from "@/lib/filter";
import FeedList from "./FeedList";
import { Plus, X } from "lucide-react";

export default function FeedClientContainer({ initialItems }: { initialItems: FeedItem[] }) {
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
        if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
            storage.addKeyword(newKeyword);
            setKeywords(storage.getPreferences().keywords);
            setNewKeyword("");
            setIsAdding(false);
        }
    };

    const handleRemoveKeyword = (keyword: string) => {
        storage.removeKeyword(keyword);
        setKeywords(storage.getPreferences().keywords);
    };

    // 필터 적용
    const filteredItems = filterFeedByKeywords(initialItems, keywords);

    return (
        <>
            <div className="mb-6 flex flex-wrap gap-2 items-center">
                {keywords.map(keyword => (
                    <div key={keyword} className="flex items-center gap-1 text-xs font-semibold bg-(--notion-hover) px-2.5 py-1 rounded">
                        <span># {keyword}</span>
                        <button
                            onClick={() => handleRemoveKeyword(keyword)}
                            className="text-(--notion-fg)/40 hover:text-(--notion-fg) rounded-full hover:bg-(--notion-gray) p-0.5"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}

                {isAdding ? (
                    <form onSubmit={handleAddKeyword} className="flex items-center">
                        <input
                            type="text"
                            autoFocus
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            onBlur={() => setTimeout(() => setIsAdding(false), 200)}
                            placeholder="관심사 입력..."
                            className="text-xs font-semibold px-2 py-1 rounded bg-(--notion-bg) border border-(--notion-border) focus:outline-none focus:border-(--notion-fg)/30 w-28"
                        />
                    </form>
                ) : (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1 text-xs font-semibold text-(--notion-fg)/50 border border-dashed border-(--notion-border) px-2.5 py-1 rounded cursor-pointer hover:bg-(--notion-hover) transition-colors"
                    >
                        <Plus size={12} />
                        <span>Add Filter</span>
                    </button>
                )}
            </div>

            <FeedList items={filteredItems} />
        </>
    );
}
