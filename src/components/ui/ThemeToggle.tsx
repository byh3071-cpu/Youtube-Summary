"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // useEffect only runs on the client, so now we can safely show the UI
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <button
                className="w-full flex items-center justify-between gap-2 text-sm text-(--notion-fg)/70 hover:bg-(--notion-hover) p-1.5 rounded-md transition-colors"
                aria-label="Toggle theme"
            >
                <div className="flex items-center gap-2">
                    <Moon size={16} />
                    <span>Theme</span>
                </div>
            </button>
        ); // fallback
    }

    const isDark = theme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="w-full flex items-center justify-between gap-2 text-sm text-(--notion-fg)/70 hover:bg-(--notion-hover) p-1.5 rounded-md transition-colors"
            aria-label="Toggle theme"
        >
            <div className="flex items-center gap-2">
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            </div>
        </button>
    );
}
