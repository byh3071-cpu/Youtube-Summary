import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSources, type FeedSource } from "@/lib/sources";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
  createServerSupabaseFromCookies: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
  createServerSupabaseFromCookies: mocks.createServerSupabaseFromCookies,
}));

import { POST, DELETE } from "./route";

function makeCookieStore(initial?: Record<string, string>) {
  const jar = new Map(Object.entries(initial ?? {}));
  return {
    jar,
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
  };
}

/** 어떤 순서의 메서드 체인이든 마지막에 await하면 테이블별 결과를 돌려주는 thenable 빌더 */
function chain(result: { error: unknown; data?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ["insert", "delete", "select", "eq", "order"]) {
    c[m] = () => c;
  }
  c.then = (resolve: (v: unknown) => void) => resolve(result);
  return c;
}

function makeSupabase(resultsByTable: Record<string, { error: unknown; data?: unknown }> = {}) {
  return {
    from: (table: string) => chain(resultsByTable[table] ?? { error: null, data: [] }),
  };
}

function koreanChannel(i: number): FeedSource {
  return {
    id: `UC${String(i).padStart(2, "0")}${"x".repeat(20)}`,
    name: "가나다라마바사아자차카타파하호호호호호호".slice(0, 20),
    type: "YouTube",
    category: "기타",
  };
}

/** 인코딩 후 4000B는 넘지만 직렬화 문자열 길이는 옛 예산(3800자) 미만인 목록 — 회귀 판별용 */
function overBudgetKoreanList(): FeedSource[] {
  const list: FeedSource[] = [];
  for (let i = 0; i < 60; i++) {
    list.push(koreanChannel(i));
    const raw = JSON.stringify(list);
    if (encodeURIComponent(raw).length > 4100) {
      expect(raw.length).toBeLessThan(3800); // 옛 검사(인코딩 전 길이)는 통과했을 크기
      return list;
    }
  }
  throw new Error("unreachable");
}

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUserFromCookies.mockResolvedValue(null);
  mocks.createServerSupabaseFromCookies.mockReturnValue(makeSupabase());
});

describe("POST /api/custom-sources — 쿠키 예산 (인코딩 후 바이트 기준)", () => {
  it("작은 목록은 쿠키에 저장된다 (비로그인)", async () => {
    const store = makeCookieStore();
    mocks.cookies.mockResolvedValue(store);

    const res = await POST(
      makeRequest({ sourceId: "UCaaaaaaaaaaaaaaaaaaaaaa", name: "테스트 채널", category: "개발" }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; cookieStored: boolean; saved: boolean };
    expect(body).toMatchObject({ ok: true, cookieStored: true, saved: false });
    const written = JSON.parse(store.jar.get("focus_feed_sources")!) as FeedSource[];
    expect(written).toHaveLength(1);
    expect(written[0].id).toBe("UCaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("한글 이름 팽창으로 인코딩 후 4KB를 넘으면 비로그인은 413 (옛 길이 검사로는 통과했을 크기)", async () => {
    const existing = overBudgetKoreanList();
    const store = makeCookieStore({ focus_feed_sources: JSON.stringify(existing.slice(0, -1)) });
    mocks.cookies.mockResolvedValue(store);
    const last = existing[existing.length - 1];

    const res = await POST(makeRequest({ sourceId: last.id, name: last.name, category: "기타" }));

    expect(res.status).toBe(413);
    // 실패 시 쿠키를 덮어쓰지 않는다
    expect(store.jar.get("focus_feed_sources")).toBe(JSON.stringify(existing.slice(0, -1)));
  });

  it("로그인 상태에서 쿠키 초과면 DB에만 저장하고 cookieStored:false를 알린다", async () => {
    const existing = overBudgetKoreanList();
    const store = makeCookieStore({ focus_feed_sources: JSON.stringify(existing.slice(0, -1)) });
    mocks.cookies.mockResolvedValue(store);
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
    const last = existing[existing.length - 1];

    const res = await POST(makeRequest({ sourceId: last.id, name: last.name, category: "기타" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; cookieStored: boolean; saved: boolean };
    expect(body).toMatchObject({ ok: true, cookieStored: false, saved: true });
  });
});

describe("DELETE /api/custom-sources — 삭제 실패 무시 금지", () => {
  it("정상 삭제: 쿠키에서 해당 채널이 빠진다", async () => {
    const a = koreanChannel(1);
    const b = koreanChannel(2);
    const store = makeCookieStore({ focus_feed_sources: JSON.stringify([a, b]) });
    mocks.cookies.mockResolvedValue(store);

    const res = await DELETE(
      new Request(`https://x.test/api/custom-sources?sourceId=${a.id}`, { method: "DELETE" }),
    );

    expect(res.status).toBe(200);
    const written = JSON.parse(store.jar.get("focus_feed_sources")!) as FeedSource[];
    expect(written.map((s) => s.id)).toEqual([b.id]);
  });

  it("남은 목록이 여전히 예산 초과라 쿠키를 못 구우면 비로그인은 413", async () => {
    const oversized = [...overBudgetKoreanList(), koreanChannel(98), koreanChannel(99)];
    const store = makeCookieStore({ focus_feed_sources: JSON.stringify(oversized) });
    mocks.cookies.mockResolvedValue(store);

    const res = await DELETE(
      new Request(`https://x.test/api/custom-sources?sourceId=${oversized[0].id}`, {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(413);
  });

  it("로그인 상태면 쿠키 실패여도 DB 삭제가 반영되므로 200", async () => {
    const oversized = [...overBudgetKoreanList(), koreanChannel(98), koreanChannel(99)];
    const store = makeCookieStore({ focus_feed_sources: JSON.stringify(oversized) });
    mocks.cookies.mockResolvedValue(store);
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });

    const res = await DELETE(
      new Request(`https://x.test/api/custom-sources?sourceId=${oversized[0].id}`, {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(200);
  });
});

describe("기본 채널 숨김/복원", () => {
  const DEFAULT_ID = defaultSources.find((s) => s.type === "YouTube")!.id;

  it("기본 채널 DELETE는 숨김 목록에 추가된다 (비로그인 쿠키)", async () => {
    const store = makeCookieStore();
    mocks.cookies.mockResolvedValue(store);

    const res = await DELETE(
      new Request(`https://x.test/api/custom-sources?sourceId=${DEFAULT_ID}`, {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()) as { hidden?: boolean }).toMatchObject({ ok: true, hidden: true });
    expect(JSON.parse(store.jar.get("focus_feed_hidden")!)).toEqual([DEFAULT_ID]);
    // 커스텀 소스 쿠키는 건드리지 않는다
    expect(store.jar.has("focus_feed_sources")).toBe(false);
  });

  it("보이는 기본 채널을 다시 추가하면 409", async () => {
    const store = makeCookieStore();
    mocks.cookies.mockResolvedValue(store);

    const res = await POST(
      makeRequest({ sourceId: DEFAULT_ID, name: "기본 채널", category: "기타" }),
    );

    expect(res.status).toBe(409);
  });

  it("숨긴 기본 채널을 다시 추가하면 커스텀 등록 대신 숨김 해제로 복원된다", async () => {
    const store = makeCookieStore({ focus_feed_hidden: JSON.stringify([DEFAULT_ID]) });
    mocks.cookies.mockResolvedValue(store);

    const res = await POST(
      makeRequest({ sourceId: DEFAULT_ID, name: "기본 채널", category: "기타" }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()) as { restored?: boolean }).toMatchObject({ restored: true });
    expect(JSON.parse(store.jar.get("focus_feed_hidden")!)).toEqual([]);
    expect(store.jar.has("focus_feed_sources")).toBe(false);
  });

  it("DB에만 숨겨져 있던 기본 채널도 로그인 상태에서 복원된다", async () => {
    const store = makeCookieStore();
    mocks.cookies.mockResolvedValue(store);
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
    mocks.createServerSupabaseFromCookies.mockReturnValue(
      makeSupabase({
        hidden_default_sources: { error: null, data: [{ source_id: DEFAULT_ID }] },
      }),
    );

    const res = await POST(
      makeRequest({ sourceId: DEFAULT_ID, name: "기본 채널", category: "기타" }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()) as { restored?: boolean }).toMatchObject({ restored: true });
    // 로그인 쓰기 경로는 소유자 마커를 남긴다
    expect(store.jar.get("focus_feed_sync_owner")).toBe("user-a");
  });

  it("로그인 삭제(숨김)는 소유자 마커를 남긴다", async () => {
    const store = makeCookieStore();
    mocks.cookies.mockResolvedValue(store);
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });

    const res = await DELETE(
      new Request(`https://x.test/api/custom-sources?sourceId=${DEFAULT_ID}`, {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(200);
    expect(JSON.parse(store.jar.get("focus_feed_hidden")!)).toEqual([DEFAULT_ID]);
    expect(store.jar.get("focus_feed_sync_owner")).toBe("user-a");
  });
});
