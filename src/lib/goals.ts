import { isBrowser } from "./env";

const GOALS_STORAGE_KEY = "focus_feed_goals_v1";

export function loadGoals(): string {
  if (!isBrowser()) return "";
  try {
    return localStorage.getItem(GOALS_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveGoals(text: string) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, text.trim());
  } catch {
    // ignore
  }
}

