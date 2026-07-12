import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSources } from "@/lib/sources";

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

import { POST } from "./route";

const DEFAULT_ID = defaultSources.find((s) => s.type === "YouTube")!.id;

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

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

const DB_ROW = {
  source_id: "UCdbdbdbdbdbdbdbdbdbdbdb",
  name: "DB 채널",
  category: "개발",
  avatar_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
  mocks.createServerSupabaseFromCookies.mockReturnValue(makeSupabase());
});

describe("POST /api/custom-sources/sync", () => {
  it("비로그인은 401", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);
    mocks.cookies.mockResolvedValue(makeCookieStore());

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it("쿠키를 DB 미러로 통째 교체하고 소유자 마커를 남긴다 (union 부활 금지)", async () => {
    // 쿠키에는 다른 기기에서 이미 삭제된 항목이 남아 있는 상황
    const stale = [{ id: "UCstalestalestalestalest", name: "삭제된 채널", type: "YouTube", category: "기타" }];
    const store = makeCookieStore({ focus_feed_sources: JSON.stringify(stale) });
    mocks.cookies.mockResolvedValue(store);
    mocks.createServerSupabaseFromCookies.mockReturnValue(
      makeSupabase({
        custom_sources: { error: null, data: [DB_ROW] },
        hidden_default_sources: { error: null, data: [{ source_id: DEFAULT_ID }] },
      }),
    );

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sources: { id: string }[]; hiddenIds: string[] };
    expect(body.sources.map((s) => s.id)).toEqual([DB_ROW.source_id]);
    expect(body.hiddenIds).toEqual([DEFAULT_ID]);

    const baked = JSON.parse(store.jar.get("focus_feed_sources")!) as { id: string }[];
    expect(baked.map((s) => s.id)).toEqual([DB_ROW.source_id]); // stale 항목이 되살아나지 않음
    expect(JSON.parse(store.jar.get("focus_feed_hidden")!)).toEqual([DEFAULT_ID]);
    expect(store.jar.get("focus_feed_sync_owner")).toBe("user-a");
  });

  it("DB 조회 실패 시 쿠키를 덮지 않고 502", async () => {
    const stale = [{ id: "UCstalestalestalestalest", name: "채널", type: "YouTube", category: "기타" }];
    const store = makeCookieStore({ focus_feed_sources: JSON.stringify(stale) });
    mocks.cookies.mockResolvedValue(store);
    mocks.createServerSupabaseFromCookies.mockReturnValue(
      makeSupabase({
        custom_sources: { error: { code: "500", message: "boom" }, data: null },
      }),
    );

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(502);
    expect(store.jar.get("focus_feed_sources")).toBe(JSON.stringify(stale));
    expect(store.jar.has("focus_feed_sync_owner")).toBe(false);
  });

  it("localHidden은 기본 채널 id만 받아들인다", async () => {
    const store = makeCookieStore();
    mocks.cookies.mockResolvedValue(store);
    const inserted: string[] = [];
    mocks.createServerSupabaseFromCookies.mockReturnValue({
      from: (table: string) => {
        const c = chain({ error: null, data: [] }) as Record<string, unknown>;
        if (table === "hidden_default_sources") {
          c.insert = (row: { source_id: string }) => {
            inserted.push(row.source_id);
            return c;
          };
        }
        return c;
      },
    });

    const res = await POST(
      makeRequest({ localHidden: [DEFAULT_ID, "UCnotdefaultnotdefault00", "garbage"] }),
    );

    expect(res.status).toBe(200);
    expect(inserted).toEqual([DEFAULT_ID]);
  });
});
