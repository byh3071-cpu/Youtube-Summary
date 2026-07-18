import { describe, expect, it } from "vitest";
import {
  REEL_PLAYBACK_POLICY,
  parseStoredReelPosition,
  reelPositionStorageKey,
  resolveStoredReelIndex,
} from "./reel-playback-policy";

describe("reel playback policy", () => {
  it("only advances shortform automatically", () => {
    expect(REEL_PLAYBACK_POLICY.longform).toEqual({ autoplay: false, advanceOnEnd: false });
    expect(REEL_PLAYBACK_POLICY.shortform).toEqual({ autoplay: true, advanceOnEnd: true });
    expect(REEL_PLAYBACK_POLICY.live).toEqual({ autoplay: true, advanceOnEnd: false });
  });

  it("uses an isolated session key for each mode", () => {
    expect(reelPositionStorageKey("shortform")).toBe("focus-feed:reel-position:shortform");
    expect(reelPositionStorageKey("live")).not.toBe(reelPositionStorageKey("shortform"));
  });

  it("restores by stable item key and safely falls back to the stored index", () => {
    const keys = ["video-a", "video-b", "video-c"];
    expect(resolveStoredReelIndex({ itemKey: "video-b", index: 0 }, keys)).toBe(1);
    expect(resolveStoredReelIndex({ itemKey: "removed", index: 9 }, keys)).toBe(2);
    expect(resolveStoredReelIndex(null, keys)).toBe(0);
  });

  it("rejects malformed stored values", () => {
    expect(parseStoredReelPosition(null)).toBeNull();
    expect(parseStoredReelPosition("not-json")).toBeNull();
    expect(parseStoredReelPosition('{"itemKey":"a","index":-1}')).toBeNull();
    expect(parseStoredReelPosition('{"itemKey":"a","index":1}')).toEqual({ itemKey: "a", index: 1 });
  });
});
