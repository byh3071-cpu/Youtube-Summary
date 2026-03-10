"use client";

import { RefreshCcw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshButton() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetch('/api/revalidate', { method: 'POST' });
            // Next.js 라우터 리프레시를 통해 서버 컴포넌트 데이터 다시 가져오기 트리거
            router.refresh();
        } catch (error) {
            console.error("Failed to revalidate UI");
        } finally {
            // 로딩 UI 시각적 피드백을 위해 약간의 딜레이
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    return (
        <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 text-sm text-[var(--notion-fg)]/60 hover:text-[var(--notion-fg)] hover:bg-[var(--notion-hover)] px-3 py-1.5 rounded transition-colors disabled:opacity-50"
        >
            <RefreshCcw size={14} className={isRefreshing ? "animate-spin" : ""} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
    );
}
