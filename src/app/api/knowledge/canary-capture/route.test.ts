import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER_ID = "8a805f4a-ab4c-475b-8b62-728df86f5ae7";
const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
  createServerSupabaseFromCookies: vi.fn(),
  enqueueAndEnrichKnowledgeCapture: vi.fn(),
  takeToken: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
  createServerSupabaseFromCookies: mocks.createServerSupabaseFromCookies,
}));
vi.mock("@/lib/knowledge-capture-server", () => ({
  enqueueAndEnrichKnowledgeCapture: mocks.enqueueAndEnrichKnowledgeCapture,
}));
vi.mock("@/lib/rate-limit", () => ({ takeToken: mocks.takeToken }));

import { POST } from "./route";

function request(body: unknown, headers?: HeadersInit): Request {
  return new Request("https://focus-feed.test/api/knowledge/canary-capture", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://focus-feed.test", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("KNOWLEDGE_CANARY_CAPTURE_ENABLED", "1");
  vi.stubEnv("KNOWLEDGE_CANARY_OWNER_USER_ID", OWNER_ID);
  mocks.cookies.mockResolvedValue({ getAll: () => [] });
  mocks.getCurrentUserFromCookies.mockResolvedValue({ id: OWNER_ID });
  mocks.createServerSupabaseFromCookies.mockReturnValue({ rpc: vi.fn() });
  mocks.takeToken.mockReturnValue({ ok: true });
  mocks.enqueueAndEnrichKnowledgeCapture.mockResolvedValue({
    ok: true,
    created: true,
    job: {
      id: "job-1",
      videoId: "abc_DEF-123",
      status: "queued",
      captureReady: true,
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
    },
  });
});

describe("POST /api/knowledge/canary-capture", () => {
  it("feature flag가 꺼져 있으면 endpoint를 숨긴다", async () => {
    vi.stubEnv("KNOWLEDGE_CANARY_CAPTURE_ENABLED", "0");
    const response = await POST(request({ items: [] }));
    expect(response.status).toBe(404);
    expect(mocks.cookies).not.toHaveBeenCalled();
  });

  it("설정된 로그인 owner만 허용한다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    const response = await POST(request({
      items: [{ url: "https://youtu.be/abc_DEF-123", title: "Canary" }],
    }));
    expect(response.status).toBe(403);
    expect(mocks.enqueueAndEnrichKnowledgeCapture).not.toHaveBeenCalled();
  });

  it("브라우저의 cross-origin 요청은 인증 조회 전에 거부한다", async () => {
    const response = await POST(request(
      { items: [{ url: "https://youtu.be/abc_DEF-123", title: "Canary" }] },
      { Origin: "https://attacker.test" },
    ));
    expect(response.status).toBe(403);
    expect(mocks.cookies).not.toHaveBeenCalled();
  });

  it("Origin이 없는 신뢰된 서버·CLI 호출은 owner 인증으로 계속 제한한다", async () => {
    const response = await POST(new Request("https://focus-feed.test/api/knowledge/canary-capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ url: "https://youtu.be/abc_DEF-123", title: "Canary" }] }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.getCurrentUserFromCookies).toHaveBeenCalledTimes(1);
  });

  it("Content-Length와 실제 stream 모두 16KiB 상한을 적용한다", async () => {
    const declared = await POST(request(
      { items: [{ url: "https://youtu.be/abc_DEF-123", title: "Canary" }] },
      { "Content-Length": "16385" },
    ));
    const streamed = await POST(new Request("https://focus-feed.test/api/knowledge/canary-capture", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://focus-feed.test", "Content-Length": "1" },
      body: JSON.stringify({ items: [{ url: "https://youtu.be/abc_DEF-123", title: "x".repeat(17_000) }] }),
    }));
    expect([declared.status, streamed.status]).toEqual([413, 413]);
    expect(mocks.enqueueAndEnrichKnowledgeCapture).not.toHaveBeenCalled();
  });

  it("HTTPS YouTube·중복 video ID·입력 길이를 fail-closed 검증한다", async () => {
    const insecure = await POST(request({ items: [{ url: "http://youtu.be/abc_DEF-123", title: "Canary" }] }));
    const duplicate = await POST(request({ items: [
      { url: "https://youtu.be/abc_DEF-123", title: "One" },
      { url: "https://www.youtube.com/watch?v=abc_DEF-123", title: "Two" },
    ] }));
    const overlong = await POST(request({ items: [{ url: "https://youtu.be/abc_DEF-123", title: "x".repeat(301) }] }));
    expect([insecure.status, duplicate.status, overlong.status]).toEqual([400, 400, 400]);
    expect(mocks.enqueueAndEnrichKnowledgeCapture).not.toHaveBeenCalled();
  });

  it("묶음 크기는 1~7개만 허용한다", async () => {
    const empty = await POST(request({ items: [] }));
    const tooMany = await POST(request({
      items: Array.from({ length: 8 }, (_, index) => ({
        url: `https://youtu.be/video_${index}`,
        title: `Canary ${index}`,
      })),
    }));
    expect([empty.status, tooMany.status]).toEqual([400, 400]);
    expect(mocks.enqueueAndEnrichKnowledgeCapture).not.toHaveBeenCalled();
  });

  it("정규 URL 목록으로 deterministic held/no-retry run과 exact job ID를 반환한다", async () => {
    const body = { items: [
      { url: "https://youtu.be/abc_DEF-123", title: "First", channelName: "Channel" },
      { url: "https://www.youtube.com/watch?v=xyz_ABC-789", title: "Second" },
    ] };
    mocks.enqueueAndEnrichKnowledgeCapture
      .mockResolvedValueOnce({
        ok: true,
        created: true,
        job: {
          id: "job-1", videoId: "abc_DEF-123", status: "queued", captureReady: true,
          createdAt: "2026-08-14T00:00:00.000Z", updatedAt: "2026-08-14T00:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        created: false,
        job: {
          id: "job-existing", videoId: "xyz_ABC-789", status: "completed", captureReady: true,
          createdAt: "2026-08-13T00:00:00.000Z", updatedAt: "2026-08-13T00:00:00.000Z",
        },
      });

    const response = await POST(request(body));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(payload.runId).toBe("bceb9a4c4cd505e5ac97b20272024dac07de4d97c88ccaf15c7219dce3ed6adb");
    expect(payload.results).toEqual([
      expect.objectContaining({ videoId: "abc_DEF-123", created: true, cleanEligible: true }),
      expect.objectContaining({ videoId: "xyz_ABC-789", created: false, cleanEligible: false }),
    ]);
    expect(mocks.enqueueAndEnrichKnowledgeCapture).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
      sourceUrl: "https://www.youtube.com/watch?v=abc_DEF-123",
      enrichExisting: false,
      metadata: expect.objectContaining({
        _canary_run_id: payload.runId,
        _canary_hold: true,
        _canary_no_retry: true,
      }),
    }));
  });

  it("뒤 항목이 실패해도 앞에서 생성된 개별 작업은 보존하고 raw 오류는 숨긴다", async () => {
    mocks.enqueueAndEnrichKnowledgeCapture
      .mockResolvedValueOnce({
        ok: true,
        created: true,
        job: {
          id: "job-1", videoId: "abc_DEF-123", status: "queued", captureReady: true,
          createdAt: "2026-08-14T00:00:00.000Z", updatedAt: "2026-08-14T00:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        code: "ENQUEUE_FAILED",
        status: 500,
        logMessage: "sensitive database detail",
      });
    const response = await POST(request({ items: [
      { url: "https://youtu.be/abc_DEF-123", title: "First" },
      { url: "https://youtu.be/xyz_ABC-789", title: "Second" },
    ] }));
    const payload = await response.json();

    expect(response.status).toBe(207);
    expect(payload.created).toBe(1);
    expect(payload.results[0]).toMatchObject({ created: true, cleanEligible: true });
    expect(payload.results[1]).toMatchObject({
      code: "ENQUEUE_FAILED",
      error: "지식 대기열 접수에 실패했습니다.",
      cleanEligible: false,
    });
    expect(JSON.stringify(payload)).not.toContain("sensitive database detail");
  });

  it("같은 정규 URL 목록을 다시 호출하면 같은 run ID와 기존 job을 반환한다", async () => {
    const body = { items: [{ url: "https://youtu.be/abc_DEF-123", title: "Canary" }] };
    mocks.enqueueAndEnrichKnowledgeCapture
      .mockResolvedValueOnce({
        ok: true,
        created: true,
        job: {
          id: "job-1", videoId: "abc_DEF-123", status: "queued", captureReady: true,
          createdAt: "2026-08-14T00:00:00.000Z", updatedAt: "2026-08-14T00:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        created: false,
        job: {
          id: "job-1", videoId: "abc_DEF-123", status: "queued", captureReady: true,
          createdAt: "2026-08-14T00:00:00.000Z", updatedAt: "2026-08-14T00:00:00.000Z",
        },
      });

    const first = await POST(request(body));
    const second = await POST(request(body));
    const firstPayload = await first.json();
    const secondPayload = await second.json();

    expect([first.status, second.status]).toEqual([201, 200]);
    expect(secondPayload.runId).toBe(firstPayload.runId);
    expect(secondPayload.results[0]).toMatchObject({
      job: { id: "job-1" },
      created: false,
      cleanEligible: false,
    });
  });
});
