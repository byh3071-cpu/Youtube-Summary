import { describe, expect, it } from "vitest";
import { hiddenSourceIdsReducer } from "@/components/layout/channel-removal-state";

describe("hiddenSourceIdsReducer", () => {
  it("서버 목록에서 제거된 뒤 같은 ID가 다시 추가되면 숨김 상태를 유지하지 않는다", () => {
    const sourceId = "UCaaaaaaaaaaaaaaaaaaaaaa";
    let hiddenSourceIds = hiddenSourceIdsReducer(new Set(), { type: "hide", sourceId });

    hiddenSourceIds = hiddenSourceIdsReducer(hiddenSourceIds, {
      type: "prune",
      sourceIds: [sourceId],
    });
    expect([...hiddenSourceIds]).toEqual([sourceId]);

    hiddenSourceIds = hiddenSourceIdsReducer(hiddenSourceIds, {
      type: "prune",
      sourceIds: [],
    });
    expect([...hiddenSourceIds]).toEqual([]);

    hiddenSourceIds = hiddenSourceIdsReducer(hiddenSourceIds, {
      type: "prune",
      sourceIds: [sourceId],
    });
    expect(hiddenSourceIds.has(sourceId)).toBe(false);
  });
});
