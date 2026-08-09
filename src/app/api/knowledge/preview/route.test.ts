import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
  getVideoSnippet: vi.fn(),
  takeToken: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
}));
vi.mock("@/lib/youtube", () => ({ getVideoSnippet: mocks.getVideoSnippet }));
vi.mock("@/lib/rate-limit", () => ({ takeToken: mocks.takeToken }));

import { GET } from "./route";

function request(url: string): Request {
  const endpoint = new URL("https://focus-feed.test/api/knowledge/preview");
  endpoint.searchParams.set("url", url);
  return new Request(endpoint);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ getAll: () => [] });
  mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
  mocks.getVideoSnippet.mockResolvedValue({ title: "테스트 영상", channelName: "테스트 채널" });
  mocks.takeToken.mockReturnValue({ ok: true });
});

describe("GET /api/knowledge/preview", () => {
  it("로그인 전에는 YouTube API를 호출하지 않는다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);

    const response = await GET(request("https://youtu.be/abc_DEF-123"));

    expect(response.status).toBe(401);
    expect(mocks.getVideoSnippet).not.toHaveBeenCalled();
  });

  it("정규 URL과 제목·채널·썸네일을 반환한다", async () => {
    const response = await GET(request("https://youtu.be/abc_DEF-123?si=tracking"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(mocks.getVideoSnippet).toHaveBeenCalledWith("abc_DEF-123");
    await expect(response.json()).resolves.toEqual({
      videoId: "abc_DEF-123",
      sourceUrl: "https://www.youtube.com/watch?v=abc_DEF-123",
      title: "테스트 영상",
      channelName: "테스트 채널",
      thumbnailUrl: "https://i.ytimg.com/vi/abc_DEF-123/hqdefault.jpg",
    });
  });

  it("잘못된 URL은 rate limit과 YouTube 호출 전에 거부한다", async () => {
    const response = await GET(request("https://example.com/video"));

    expect(response.status).toBe(400);
    expect(mocks.takeToken).not.toHaveBeenCalled();
    expect(mocks.getVideoSnippet).not.toHaveBeenCalled();
  });

  it("rate limit은 Retry-After와 함께 429를 반환한다", async () => {
    mocks.takeToken.mockReturnValue({ ok: false, retryAfterSec: 9 });

    const response = await GET(request("https://youtu.be/abc_DEF-123"));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("9");
    expect(mocks.getVideoSnippet).not.toHaveBeenCalled();
  });
});
