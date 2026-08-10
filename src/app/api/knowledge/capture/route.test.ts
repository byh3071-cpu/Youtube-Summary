import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
  createServerSupabaseFromCookies: vi.fn(),
  getVideoSnippet: vi.fn(),
  takeToken: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
  createServerSupabaseFromCookies: mocks.createServerSupabaseFromCookies,
}));
vi.mock("@/lib/youtube", () => ({ getVideoSnippet: mocks.getVideoSnippet }));
vi.mock("@/lib/rate-limit", () => ({ takeToken: mocks.takeToken }));

import { POST } from "./route";

const JOB = {
  id: "job-1",
  video_id: "abc_DEF-123",
  status: "queued",
  capture_ready: true,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

const PENDING_JOB = { ...JOB, capture_ready: false };

function makeRequest(body: unknown): Request {
  return new Request("https://focus-feed.test/api/knowledge/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCaptureClient(result: {
  data: Array<typeof JOB & { created: boolean }> | null;
  error: { code?: string; message: string } | null;
}) {
  const client = {
    rpc: vi.fn().mockResolvedValue(result),
  };
  return { client };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ getAll: () => [] });
  mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
  mocks.getVideoSnippet.mockResolvedValue(null);
  mocks.takeToken.mockReturnValue({ ok: true });
});

describe("POST /api/knowledge/capture", () => {
  it("비로그인 요청은 401이며 DB와 YouTube를 호출하지 않는다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);

    const response = await POST(makeRequest({ url: "https://youtu.be/abc_DEF-123" }));

    expect(response.status).toBe(401);
    expect(mocks.createServerSupabaseFromCookies).not.toHaveBeenCalled();
    expect(mocks.getVideoSnippet).not.toHaveBeenCalled();
  });

  it("잘못된 YouTube URL은 400이다", async () => {
    const response = await POST(makeRequest({ url: "https://example.com/video" }));

    expect(response.status).toBe(400);
    expect(mocks.createServerSupabaseFromCookies).not.toHaveBeenCalled();
  });

  it("null·배열처럼 객체가 아닌 JSON body는 400이다", async () => {
    const nullResponse = await POST(makeRequest(null));
    const arrayResponse = await POST(makeRequest([]));

    expect(nullResponse.status).toBe(400);
    expect(arrayResponse.status).toBe(400);
    expect(mocks.createServerSupabaseFromCookies).not.toHaveBeenCalled();
  });

  it("쿠키 세션 클라이언트로 원자적 enqueue RPC를 호출한다", async () => {
    const { client } = makeCaptureClient({ data: [{ ...PENDING_JOB, created: true }], error: null });
    client.rpc
      .mockResolvedValueOnce({ data: [{ ...PENDING_JOB, created: true }], error: null })
      .mockResolvedValueOnce({ data: [JOB], error: null });
    mocks.createServerSupabaseFromCookies.mockReturnValue(client);

    const response = await POST(makeRequest({ url: "https://youtu.be/abc_DEF-123" }));

    expect(response.status).toBe(201);
    expect(client.rpc).toHaveBeenCalledWith("enqueue_knowledge_job", expect.objectContaining({
      p_source_key: "abc_DEF-123",
      p_video_id: "abc_DEF-123",
    }));
    expect(client.rpc.mock.calls[0]?.[1]).not.toHaveProperty("user_id");
    expect(client.rpc.mock.calls[0]?.[1]).not.toHaveProperty("status");
    await expect(response.json()).resolves.toMatchObject({
      created: true,
      job: { id: "job-1", videoId: "abc_DEF-123", status: "queued" },
    });
  });

  it("같은 사용자의 중복 작업은 기존 작업과 created:false를 반환한다", async () => {
    const { client } = makeCaptureClient({ data: [{ ...JOB, created: false }], error: null });
    mocks.createServerSupabaseFromCookies.mockReturnValue(client);

    const response = await POST(makeRequest({ url: "https://youtu.be/abc_DEF-123" }));

    expect(response.status).toBe(200);
    expect(mocks.getVideoSnippet).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({ created: false, job: { id: "job-1" } });
  });

  it("API burst 한도는 YouTube 조회 전에 429와 Retry-After를 반환한다", async () => {
    const { client } = makeCaptureClient({ data: [{ ...JOB, created: true }], error: null });
    mocks.createServerSupabaseFromCookies.mockReturnValue(client);
    mocks.takeToken.mockReturnValue({ ok: false, retryAfterSec: 12 });

    const response = await POST(makeRequest({ url: "https://youtu.be/abc_DEF-123" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(mocks.getVideoSnippet).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("DB의 사용자별 active·daily 한도는 429로 표시한다", async () => {
    const { client } = makeCaptureClient({
      data: null,
      error: { code: "P0001", message: "knowledge_queue_active_limit" },
    });
    mocks.createServerSupabaseFromCookies.mockReturnValue(client);

    const response = await POST(makeRequest({ url: "https://youtu.be/abc_DEF-123" }));

    expect(response.status).toBe(429);
    expect(mocks.getVideoSnippet).not.toHaveBeenCalled();
  });

  it("신규 enqueue가 성공한 뒤에만 YouTube 메타를 보강한다", async () => {
    const enrichedJob = {
      ...JOB,
      updated_at: "2026-08-01T00:01:00.000Z",
    };
    const { client } = makeCaptureClient({ data: [{ ...PENDING_JOB, created: true }], error: null });
    client.rpc
      .mockResolvedValueOnce({ data: [{ ...PENDING_JOB, created: true }], error: null })
      .mockResolvedValueOnce({ data: [enrichedJob], error: null });
    mocks.createServerSupabaseFromCookies.mockReturnValue(client);
    mocks.getVideoSnippet.mockResolvedValue({
      title: "보강된 제목",
      channelName: "보강된 채널",
      description: "00:00 시작",
    });

    const response = await POST(makeRequest({ url: "https://youtu.be/abc_DEF-123" }));

    expect(response.status).toBe(201);
    expect(client.rpc).toHaveBeenNthCalledWith(2, "enrich_knowledge_job", expect.objectContaining({
      p_job_id: "job-1",
      p_title: "보강된 제목",
    }));
    await expect(response.json()).resolves.toMatchObject({
      job: { captureReady: true, updatedAt: "2026-08-01T00:01:00.000Z" },
    });
  });

  it("중단된 중복 예약은 YouTube API가 없어도 기본 메타로 준비를 마친다", async () => {
    const { client } = makeCaptureClient({ data: [{ ...PENDING_JOB, created: false }], error: null });
    client.rpc
      .mockResolvedValueOnce({ data: [{ ...PENDING_JOB, created: false }], error: null })
      .mockResolvedValueOnce({ data: [JOB], error: null });
    mocks.createServerSupabaseFromCookies.mockReturnValue(client);

    const response = await POST(makeRequest({ url: "https://youtu.be/abc_DEF-123" }));

    expect(response.status).toBe(200);
    expect(mocks.getVideoSnippet).toHaveBeenCalledWith("abc_DEF-123");
    expect(client.rpc).toHaveBeenNthCalledWith(2, "enrich_knowledge_job", expect.objectContaining({
      p_job_id: "job-1",
      p_title: "YouTube abc_DEF-123",
    }));
    await expect(response.json()).resolves.toMatchObject({
      created: false,
      job: { captureReady: true },
    });
  });

  it("보강 RPC가 schema cache에 없으면 미완료 작업과 Retry-After를 포함해 503을 반환한다", async () => {
    const { client } = makeCaptureClient({ data: [{ ...PENDING_JOB, created: true }], error: null });
    client.rpc
      .mockResolvedValueOnce({ data: [{ ...PENDING_JOB, created: true }], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST202", message: "enrich_knowledge_job is not available in the schema cache" },
      });
    mocks.createServerSupabaseFromCookies.mockReturnValue(client);

    const response = await POST(makeRequest({ url: "https://youtu.be/abc_DEF-123" }));

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    await expect(response.json()).resolves.toMatchObject({
      created: true,
      job: { captureReady: false },
    });
  });

  it.each(["42P01", "PGRST205", "PGRST202"])("migration 또는 schema cache 오류 %s는 503으로 안전하게 닫는다", async (code) => {
    const message = code === "PGRST202"
      ? "enqueue_knowledge_job is not available in the schema cache"
      : "knowledge_jobs is not available in the schema cache";
    const { client } = makeCaptureClient({ data: null, error: { code, message } });
    mocks.createServerSupabaseFromCookies.mockReturnValue(client);

    const response = await POST(makeRequest({ url: "https://youtu.be/abc_DEF-123" }));

    expect(response.status).toBe(503);
  });
});
