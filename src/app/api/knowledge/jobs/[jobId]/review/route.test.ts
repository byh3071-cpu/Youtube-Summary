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

const JOB_ID = "123e4567-e89b-42d3-a456-426614174000";
const REVIEW_ROW = {
  id: JOB_ID,
  user_id: "user-a",
  status: "review_required" as const,
  quality_score: 96,
  quality_report: { warnings: ["외부 사실은 별도 확인"] },
  result: {
    review_path: "C:/private/reviews/job.json",
    source_hash: "private-source-hash",
    draft: {
      summary: "사용자가 확인할 수 있는 검토 요약",
      key_points: ["핵심 요점"],
      claims: [{
        type: "fact",
        statement: "타임스탬프로 확인할 사실",
        evidence_quote: "a short private evidence excerpt for review",
        citation: "[00:51]",
        citation_verified: true,
        requires_crosscheck: false,
      }],
      coverage: {},
      uncertainties: ["없음"],
    },
  },
};

function makeReviewClient(result: { data: typeof REVIEW_ROW | null; error: { code?: string; message: string } | null }) {
  const table = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  table.select.mockReturnValue(table);
  table.eq.mockReturnValue(table);
  table.maybeSingle.mockResolvedValue(result);
  return { client: { from: vi.fn(() => table) }, table };
}

const callGet = (jobId = JOB_ID) => GET(
  new Request(`https://focus-feed.test/api/knowledge/jobs/${jobId}/review`),
  { params: Promise.resolve({ jobId }) },
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ getAll: () => [] });
  mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
});

describe("GET /api/knowledge/jobs/:jobId/review", () => {
  it("잘못된 ID는 DB를 조회하지 않고 거부한다", async () => {
    const response = await callGet("not-a-job-id");
    expect(response.status).toBe(400);
    expect(mocks.getServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("비로그인 요청은 검토 결과를 조회하지 않는다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);
    const response = await callGet();
    expect(response.status).toBe(401);
    expect(mocks.getServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("사용자와 작업 ID를 함께 제한하고 허용된 검토 필드만 반환한다", async () => {
    const { client, table } = makeReviewClient({ data: REVIEW_ROW, error: null });
    mocks.getServerSupabaseClient.mockReturnValue(client);

    const response = await callGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(table.eq).toHaveBeenNthCalledWith(1, "user_id", "user-a");
    expect(table.eq).toHaveBeenNthCalledWith(2, "id", JOB_ID);
    expect(body.review).toMatchObject({
      qualityScore: 96,
      summary: "사용자가 확인할 수 있는 검토 요약",
      claims: [{ evidenceExcerpt: "a short private evidence excerpt for review", citation: "[00:51]" }],
    });
    expect(JSON.stringify(body)).not.toContain("private-source-hash");
    expect(JSON.stringify(body)).not.toContain("C:/private");
  });

  it("현재 사용자에게 없는 작업은 404로 숨긴다", async () => {
    const { client } = makeReviewClient({ data: null, error: null });
    mocks.getServerSupabaseClient.mockReturnValue(client);
    const response = await callGet();
    expect(response.status).toBe(404);
  });
});
