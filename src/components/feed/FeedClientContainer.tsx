"use client";

import { useState, useEffect } from "react";
import { FeedItem } from "@/types/feed";
import { storage } from "@/lib/storage";
import { filterFeedByKeywords } from "@/lib/filter";
import FeedList from "./FeedList";
import { Plus, X } from "lucide-react";

export default function FeedClientContainer({ initialItems }: { initialItems: FeedItem[] }) {
    const [keywords, setKeywords] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newKeyword, setNewKeyword] = useState("");

    // 클라이언트 마운트 시 저장소에서 키워드 불러오기
    useEffect(() => {
        const prefs = storage.getPreferences();
        setKeywords(prefs.keywords);
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
                    <div key={keyword} className="flex items-center gap-1 text-xs font-semibold bg-[var(--notion-hover)] px-2.5 py-1 rounded">
                        <span># {keyword}</span>
                        <button
                            onClick={() => handleRemoveKeyword(keyword)}
                            className="text-[var(--notion-fg)]/40 hover:text-[var(--notion-fg)] rounded-full hover:bg-[var(--notion-gray)] p-0.5"
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
                            className="text-xs font-semibold px-2 py-1 rounded bg-[var(--notion-bg)] border border-[var(--notion-border)] focus:outline-none focus:border-[var(--notion-fg)]/30 w-28"
                        />
                    </form>
                ) : (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1 text-xs font-semibold text-[var(--notion-fg)]/50 border border-dashed border-[var(--notion-border)] px-2.5 py-1 rounded cursor-pointer hover:bg-[var(--notion-hover)] transition-colors"
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
