export type ReelViewMode = "longform" | "shortform" | "live";

export type ReelPlaybackPolicy = {
  autoplay: boolean;
  advanceOnEnd: boolean;
};

export const REEL_PLAYBACK_POLICY: Record<ReelViewMode, ReelPlaybackPolicy> = {
  longform: { autoplay: false, advanceOnEnd: false },
  shortform: { autoplay: true, advanceOnEnd: true },
  live: { autoplay: true, advanceOnEnd: false },
};

const REEL_POSITION_PREFIX = "focus-feed:reel-position:";

export type StoredReelPosition = {
  itemKey: string;
  index: number;
};

export function reelPositionStorageKey(mode: ReelViewMode) {
  return `${REEL_POSITION_PREFIX}${mode}`;
}

export function parseStoredReelPosition(raw: string | null): StoredReelPosition | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredReelPosition>;
    if (typeof value.itemKey !== "string" || !Number.isInteger(value.index) || value.index! < 0) {
      return null;
    }
    return { itemKey: value.itemKey, index: value.index! };
  } catch {
    return null;
  }
}

export function resolveStoredReelIndex(
  stored: StoredReelPosition | null,
  itemKeys: string[],
) {
  if (!stored || itemKeys.length === 0) return 0;
  const currentIndex = itemKeys.indexOf(stored.itemKey);
  if (currentIndex >= 0) return currentIndex;
  return Math.min(stored.index, itemKeys.length - 1);
}
