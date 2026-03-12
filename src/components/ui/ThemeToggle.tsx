"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // useEffect only runs on the client, so now we can safely show the UI
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <button
                className={`flex items-center text-(--notion-fg)/70 hover:bg-(--notion-hover) rounded-lg transition-colors ${iconOnly ? 'p-2 justify-center min-h-[44px] min-w-[44px]' : 'w-full justify-between gap-2 text-sm p-1.5'}`}
                aria-label="테마 전환"
            >
                <div className="flex items-center gap-2">
                    <Moon size={iconOnly ? 20 : 16} />
                    {!iconOnly && <span>테마</span>}
                </div>
            </button>
        ); // fallback
    }

    const isDark = theme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`flex items-center text-(--notion-fg)/70 hover:bg-(--notion-hover) rounded-lg transition-colors ${iconOnly ? 'p-2 justify-center min-h-[44px] min-w-[44px] touch-manipulation' : 'w-full justify-between gap-2 text-sm p-1.5'}`}
            aria-label="테마 전환"
        >
            <div className="flex items-center gap-2">
                {isDark ? <Sun size={iconOnly ? 20 : 16} /> : <Moon size={iconOnly ? 20 : 16} />}
                {!iconOnly && <span>{isDark ? "라이트 모드" : "다크 모드"}</span>}
            </div>
        </button>
    );
}
