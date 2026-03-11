export interface WatchProgress {
  videoId: string;
  lastPositionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
  completed: boolean;
}

const STORAGE_KEY = "focus_feed_watch_history_v1";
const COMPLETED_THRESHOLD = 0.9;
const MAX_ENTRIES = 200;

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function loadAll(): Record<string, WatchProgress> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, WatchProgress>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, WatchProgress>) {
  if (!isBrowser()) return;
  try {
    // 오래된 항목 정리
    const entries = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
    const trimmed = entries.slice(0, MAX_ENTRIES);
    const next: Record<string, WatchProgress> = {};
    for (const e of trimmed) {
      next[e.videoId] = e;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function getWatchProgress(videoId: string): WatchProgress | null {
  const all = loadAll();
  const entry = all[videoId];
  if (!entry) return null;
  if (entry.durationSeconds <= 0) return entry;
  const ratio = entry.lastPositionSeconds / entry.durationSeconds;
  return {
    ...entry,
    // 한 번 completed가 true가 되었으면 다시 false로 돌아가지 않도록 유지
    completed: entry.completed || ratio >= COMPLETED_THRESHOLD,
  };
}

export function saveWatchProgress(videoId: string, lastPositionSeconds: number, durationSeconds: number) {
  if (!isBrowser()) return;
  if (!videoId) return;
  if (!Number.isFinite(lastPositionSeconds) || !Number.isFinite(durationSeconds)) return;
  if (durationSeconds <= 0) return;

  const all = loadAll();
  const prev = all[videoId];
  const now = Date.now();
  const clampedLast = Math.max(0, Math.min(lastPositionSeconds, durationSeconds));
  const ratio = clampedLast / durationSeconds;
  const prevCompleted = prev?.completed === true;
  const completed = prevCompleted || ratio >= COMPLETED_THRESHOLD;

  const next: WatchProgress = {
    videoId,
    lastPositionSeconds: clampedLast,
    durationSeconds,
    updatedAt: now,
    // 기존에 완료된 영상은 이후 다시 봐도 completed를 false로 되돌리지 않음
    completed,
  };

  // 너무 작은 차이는 저장하지 않아도 됨
  if (prev) {
    const delta = Math.abs(prev.lastPositionSeconds - next.lastPositionSeconds);
    if (delta < 5 && !(!prev.completed && next.completed)) {
      // 5초 미만 차이이며, 완료 상태로 새로 바뀐 것도 아니면 건너뜀
      return;
    }
  }

  all[videoId] = next;
  saveAll(all);
}

