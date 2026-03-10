"use client";

import { RefreshCcw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshButton() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const router = useRouter();

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setStatusMessage("");

        try {
            const response = await fetch('/api/revalidate', { method: 'POST' });

            if (!response.ok) {
                throw new Error('Revalidation request failed');
            }

            // Next.js 라우터 리프레시를 통해 서버 컴포넌트 데이터 다시 가져오기 트리거
            router.refresh();
            setStatusMessage("최신 피드를 다시 불러왔습니다.");
        } catch (error) {
            console.error("Failed to revalidate UI", error);
            setStatusMessage("새로고침에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        } finally {
            // 로딩 UI 시각적 피드백을 위해 약간의 딜레이
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    return (
        <div className="flex flex-col items-start gap-2 sm:items-end">
            <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-(--notion-fg)/60 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg) disabled:opacity-50"
            >
                <RefreshCcw size={14} className={isRefreshing ? "animate-spin" : ""} />
                <span>{isRefreshing ? '새로고침 중...' : '새로고침'}</span>
            </button>

            <span aria-live="polite" className="text-xs text-(--notion-fg)/50">
                {statusMessage || "최신 피드를 다시 가져올 수 있습니다."}
            </span>
        </div>
    );
}
