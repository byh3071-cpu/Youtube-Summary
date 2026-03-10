export interface UserPreferences {
    keywords: string[];
    hiddenSources: string[]; // 숨긴 채널 또는 RSS 피드 ID 목록 (향후 확장용)
}

const STORAGE_KEY = 'focus_feed_preferences';

const defaultPreferences: UserPreferences = {
    keywords: [], // 예: ['AI', '자동화', '생산성']
    hiddenSources: [],
};

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
        if (!prefs.keywords.includes(keyword) && keyword.trim() !== '') {
            prefs.keywords.push(keyword.trim());
            storage.savePreferences(prefs);
        }
    },

    removeKeyword: (keyword: string): void => {
        const prefs = storage.getPreferences();
        prefs.keywords = prefs.keywords.filter(k => k !== keyword);
        storage.savePreferences(prefs);
    }
};
