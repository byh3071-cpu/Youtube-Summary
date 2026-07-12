import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSources, type FeedSource } from "@/lib/sources";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
  getCustomSourcesFromDb: vi.fn(),
  getHiddenSourceIdsFromDb: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
  getCustomSourcesFromDb: mocks.getCustomSourcesFromDb,
  getHiddenSourceIdsFromDb: mocks.getHiddenSourceIdsFromDb,
}));

import { getSessionSourcesBundle } from "@/lib/merged-session-sources";

const FIRST_DEFAULT_YT = defaultSources.find((s) => s.type === "YouTube")!;
const RSS_COUNT = defaultSources.filter((s) => s.type === "RSS").length;

const customX: FeedSource = {
  id: "UCxxxxxxxxxxxxxxxxxxxxxx",
  name: "커스텀 X",
  type: "YouTube",
  category: "개발",
};
const customY: FeedSource = {
  id: "UCyyyyyyyyyyyyyyyyyyyyyy",
  name: "커스텀 Y",
  type: "YouTube",
  category: "개발",
};

function setCookies(values: Record<string, string>) {
  mocks.cookies.mockResolvedValue({
    get: (name: string) => (name in values ? { name, value: values[name] } : undefined),
    getAll: () => Object.entries(values).map(([name, value]) => ({ name, value })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setCookies({});
  mocks.getCurrentUserFromCookies.mockResolvedValue(null);
  mocks.getCustomSourcesFromDb.mockResolvedValue([]);
  mocks.getHiddenSourceIdsFromDb.mockResolvedValue([]);
});

describe("getSessionSourcesBundle — 비로그인", () => {
  it("쿠키 없으면 기본 소스 전체", async () => {
    const { mergedSources } = await getSessionSourcesBundle();
    expect(mergedSources).toEqual(defaultSources);
  });

  it("숨긴 기본 채널은 빠지고 RSS는 유지된다", async () => {
    setCookies({
      focus_feed_hidden: JSON.stringify([FIRST_DEFAULT_YT.id]),
      focus_feed_sources: JSON.stringify([customX]),
    });
    const { mergedSources } = await getSessionSourcesBundle();
    const ids = mergedSources.map((s) => s.id);
    expect(ids).not.toContain(FIRST_DEFAULT_YT.id);
    expect(ids).toContain(customX.id);
    expect(mergedSources.filter((s) => s.type === "RSS")).toHaveLength(RSS_COUNT);
  });

  it("커스텀에 섞인 기본 채널 id(레거시)는 중복 표시하지 않는다", async () => {
    setCookies({
      focus_feed_sources: JSON.stringify([{ ...customX, id: FIRST_DEFAULT_YT.id }]),
    });
    const { mergedSources } = await getSessionSourcesBundle();
    expect(mergedSources.filter((s) => s.id === FIRST_DEFAULT_YT.id)).toHaveLength(1);
  });

  it("레거시 커스텀의 기본 채널 id가 숨김을 무력화하지 않는다", async () => {
    setCookies({
      focus_feed_hidden: JSON.stringify([FIRST_DEFAULT_YT.id]),
      focus_feed_sources: JSON.stringify([{ ...customX, id: FIRST_DEFAULT_YT.id }]),
    });
    const { mergedSources } = await getSessionSourcesBundle();
    expect(mergedSources.map((s) => s.id)).not.toContain(FIRST_DEFAULT_YT.id);
  });
});

describe("getSessionSourcesBundle — 로그인 (소유자 마커 시맨틱)", () => {
  beforeEach(() => {
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
  });

  it("마커==유저: 쿠키는 미러 — DB가 진실 (낡은 쿠키의 삭제된 채널이 부활하지 않는다)", async () => {
    setCookies({
      focus_feed_sources: JSON.stringify([customX]), // 다른 기기에서 이미 삭제된 항목
      focus_feed_sync_owner: "user-a",
    });
    mocks.getCustomSourcesFromDb.mockResolvedValue([customY]);
    mocks.getHiddenSourceIdsFromDb.mockResolvedValue([FIRST_DEFAULT_YT.id]);

    const { mergedSources } = await getSessionSourcesBundle();
    const ids = mergedSources.map((s) => s.id);
    expect(ids).not.toContain(customX.id);
    expect(ids).toContain(customY.id);
    expect(ids).not.toContain(FIRST_DEFAULT_YT.id);
  });

  it("마커==유저 + DB 조회 실패: 쿠키 미러로 폴백해 목록이 통째로 사라지지 않는다", async () => {
    setCookies({
      focus_feed_sources: JSON.stringify([customX]),
      focus_feed_sync_owner: "user-a",
    });
    mocks.getCustomSourcesFromDb.mockResolvedValue(null);
    mocks.getHiddenSourceIdsFromDb.mockResolvedValue(null);

    const { mergedSources } = await getSessionSourcesBundle();
    expect(mergedSources.map((s) => s.id)).toContain(customX.id);
  });

  it("마커!=유저: 이전 계정 잔재 쿠키는 무시한다", async () => {
    setCookies({
      focus_feed_sources: JSON.stringify([customX]),
      focus_feed_sync_owner: "user-b",
    });
    mocks.getCustomSourcesFromDb.mockResolvedValue([customY]);

    const { mergedSources } = await getSessionSourcesBundle();
    const ids = mergedSources.map((s) => s.id);
    expect(ids).not.toContain(customX.id);
    expect(ids).toContain(customY.id);
  });

  it("마커 없음: 비로그인 시절 쿠키 — push 전까지 합집합으로 표시", async () => {
    setCookies({
      focus_feed_sources: JSON.stringify([customX]),
    });
    mocks.getCustomSourcesFromDb.mockResolvedValue([customY]);

    const { mergedSources } = await getSessionSourcesBundle();
    const ids = mergedSources.map((s) => s.id);
    expect(ids).toContain(customX.id);
    expect(ids).toContain(customY.id);
  });
});
