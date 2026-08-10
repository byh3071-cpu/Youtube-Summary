import { beforeEach, describe, expect, it, vi } from "vitest";
import { KNOWLEDGE_STATUS_QUERY_LIMIT } from "@/lib/knowledge-capture";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
  getServerSupabaseClient: vi.fn(),
  takeToken: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
}));
vi.mock("@/lib/supabase-server", () => ({
  getServerSupabaseClient: mocks.getServerSupabaseClient,
}));
vi.mock("@/lib/rate-limit", () => ({ takeToken: mocks.takeToken }));

import { GET } from "./route";

const JOB = {
  id: "job-1",
  video_id: "abc_DEF-123",
  status: "processing",
  capture_ready: true,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:01:00.000Z",
};

function makeStatusClient(result: {
  data: typeof JOB[] | null;
  error: { code?: string; message: string } | null;
}) {
  const table = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  };
  table.select.mockReturnValue(table);
  table.eq.mockReturnValue(table);
  table.in.mockResolvedValue(result);
  const client = { from: vi.fn(() => table) };
  return { client, table };
}

function makeRequest(videoIds: string): Request {
  const url = new URL("https://focus-feed.test/api/knowledge/status");
  url.searchParams.set("videoIds", videoIds);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ getAll: () => [] });
  mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
  mocks.takeToken.mockReturnValue({ ok: true });
});

describe("GET /api/knowledge/status", () => {
  it("비로그인 요청은 401이다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);

    const response = await GET(makeRequest("abc_DEF-123"));

    expect(response.status).toBe(401);
    expect(mocks.getServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("50개를 넘는 조회는 DB 호출 전에 400으로 거부한다", async () => {
    const ids = Array.from(
      { length: KNOWLEDGE_STATUS_QUERY_LIMIT + 1 },
      (_, index) => `video_${String(index).padStart(3, "0")}`,
    ).join(",");

    const response = await GET(makeRequest(ids));

    expect(response.status).toBe(400);
    expect(mocks.getServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("RLS 세션에 더해 현재 사용자와 YouTube 소스를 명시적으로 제한한다", async () => {
    const { client, table } = makeStatusClient({ data: [JOB], error: null });
    mocks.getServerSupabaseClient.mockReturnValue(client);

    const response = await GET(makeRequest("abc_DEF-123"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(client.from).toHaveBeenCalledWith("knowledge_jobs");
    expect(table.eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(table.eq).toHaveBeenCalledWith("source_type", "youtube");
    expect(table.in).toHaveBeenCalledWith("video_id", ["abc_DEF-123"]);
    await expect(response.json()).resolves.toEqual({
      jobs: [{
        id: "job-1",
        videoId: "abc_DEF-123",
        status: "processing",
        captureReady: true,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:01:00.000Z",
      }],
    });
  });

  it("상태 polling burst는 DB 호출 전에 429와 Retry-After를 반환한다", async () => {
    mocks.takeToken.mockReturnValue({ ok: false, retryAfterSec: 7 });

    const response = await GET(makeRequest("abc_DEF-123"));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("7");
    expect(mocks.getServerSupabaseClient).not.toHaveBeenCalled();
  });

  it.each(["42P01", "42703", "PGRST204", "PGRST205"])("migration 또는 schema cache 오류 %s는 503을 반환한다", async (code) => {
    const { client } = makeStatusClient({
      data: null,
      error: { code, message: "knowledge_jobs is not available in the schema cache" },
    });
    mocks.getServerSupabaseClient.mockReturnValue(client);

    const response = await GET(makeRequest("abc_DEF-123"));

    expect(response.status).toBe(503);
  });
});
