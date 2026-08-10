import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
  getServerSupabaseClient: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
}));
vi.mock("@/lib/supabase-server", () => ({
  getServerSupabaseClient: mocks.getServerSupabaseClient,
}));

import { GET } from "./route";

const REVIEW_JOB = {
  id: "job-1",
  video_id: "abc_DEF-123",
  source_url: "https://www.youtube.com/watch?v=abc_DEF-123",
  title: "검토 영상",
  channel_name: "검토 채널",
  status: "review_required" as const,
  failure_code: null,
  capture_ready: true,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:01:00.000Z",
};

function makeJobsClient(result: { data: typeof REVIEW_JOB[] | null; error: { code?: string; message: string } | null }) {
  const table = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  table.select.mockReturnValue(table);
  table.eq.mockReturnValue(table);
  table.order.mockReturnValue(table);
  table.limit.mockResolvedValue(result);
  return { client: { from: vi.fn(() => table) }, table };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ getAll: () => [] });
  mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
});

describe("GET /api/knowledge/jobs", () => {
  it("비로그인 요청은 검토 데이터를 조회하지 않고 401을 반환한다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.getServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("현재 사용자 행만 조회하고 목록에는 큰 검토 결과를 포함하지 않는다", async () => {
    const { client, table } = makeJobsClient({ data: [REVIEW_JOB], error: null });
    mocks.getServerSupabaseClient.mockReturnValue(client);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(table.eq).toHaveBeenCalledWith("user_id", "user-a");
    expect(body.jobs[0]).toMatchObject({
      id: "job-1",
      reviewAvailable: true,
    });
    expect(table.select.mock.calls[0][0]).not.toContain("result");
    expect(body.jobs[0]).not.toHaveProperty("review");
  });

  it("저장된 source URL이 오염돼도 video ID 기반 YouTube 링크만 반환한다", async () => {
    const unsafeJob = { ...REVIEW_JOB, source_url: "javascript:alert(1)" };
    const { client } = makeJobsClient({ data: [unsafeJob], error: null });
    mocks.getServerSupabaseClient.mockReturnValue(client);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.jobs[0].sourceUrl).toBe("https://www.youtube.com/watch?v=abc_DEF-123");
  });
});
