export interface UserPreferences {
    keywords: string[];
    hiddenSources: string[]; // 숨긴 채널 또는 RSS 피드 ID 목록 (향후 확장용)
}

const STORAGE_KEY = 'focus_feed_preferences';

const defaultPreferences: UserPreferences = {
    keywords: [], // 예: ['AI', '자동화', '생산성']
    hiddenSources: [],
};

function normalizeKeyword(keyword: string): string {
    return keyword.trim().replace(/\s+/g, ' ');
}

// 클라이언트 사이드에서만 안전하게 실행되도록 체크
const isBrowser = typeof window !== 'undefined';

export const storage = {
    getPreferences: (): UserPreferences => {
        if (!isBrowser) return defaultPreferences;

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : defaultPreferences;
        } catch (error) {
            console.error('Failed to parse preferences from localStorage:', error);
            return defaultPreferences;
        }
    },

    savePreferences: (prefs: UserPreferences): void => {
        if (!isBrowser) return;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch (error) {
            console.error('Failed to save preferences to localStorage:', error);
        }
    },

    addKeyword: (keyword: string): void => {
        const prefs = storage.getPreferences();

        const normalizedKeyword = normalizeKeyword(keyword);
        const hasDuplicate = prefs.keywords.some(
            (existingKeyword) => existingKeyword.toLowerCase() === normalizedKeyword.toLowerCase()
        );

        if (!hasDuplicate && normalizedKeyword !== '') {
            prefs.keywords.push(normalizedKeyword);
            storage.savePreferences(prefs);
        }
    },

    removeKeyword: (keyword: string): void => {
        const prefs = storage.getPreferences();
        const normalizedKeyword = normalizeKeyword(keyword).toLowerCase();
        prefs.keywords = prefs.keywords.filter(k => k.toLowerCase() !== normalizedKeyword);
        storage.savePreferences(prefs);
    }
};
