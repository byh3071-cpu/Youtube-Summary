import { afterEach, describe, expect, it, vi } from "vitest";

// youtube.ts는 모듈 로드 시점에 YOUTUBE_API_KEY를 읽으므로
// stubEnv → resetModules → dynamic import 순서가 필요하다.
async function importWithApiKey() {
  vi.stubEnv("YOUTUBE_API_KEY", "test-api-key");
  vi.resetModules();
  return import("@/lib/youtube");
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("getVideoChannelId", () => {
  it("videos.list snippet에서 channelId를 추출한다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ items: [{ snippet: { channelId: "UCUpJs89fSBXNolQGOYKn0YQ" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { getVideoChannelId } = await importWithApiKey();

    const channelId = await getVideoChannelId("dQw4w9WgXcQ");

    expect(channelId).toBe("UCUpJs89fSBXNolQGOYKn0YQ");
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/youtube/v3/videos");
    expect(calledUrl).toContain("id=dQw4w9WgXcQ");
    expect(calledUrl).toContain("part=snippet");
  });

  it("영상이 없거나(빈 items) 응답 실패면 null", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response("quota", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getVideoChannelId } = await importWithApiKey();

    expect(await getVideoChannelId("dQw4w9WgXcQ")).toBeNull();
    expect(await getVideoChannelId("dQw4w9WgXcQ")).toBeNull();
  });

  it("videos.list 응답이 멈추면 8초 후 null로 종료한다", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal;
        return new Promise<Response>(() => {});
      }),
    );
    const { getVideoChannelId } = await importWithApiKey();

    let settled = false;
    let result: string | null | undefined;
    void getVideoChannelId("dQw4w9WgXcQ").then((value) => {
      settled = true;
      result = value;
    });

    await vi.advanceTimersByTimeAsync(7_999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    expect(settled).toBe(true);
    expect(result).toBeNull();
    expect(requestSignal?.aborted).toBe(true);
  });

  it("videos.list 본문이 멈춰도 전체 8초 안에 null로 종료한다", async () => {
    vi.useFakeTimers();
    const stalledBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"items":['));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stalledBody, { status: 200 })),
    );
    const { getVideoChannelId } = await importWithApiKey();

    let settled = false;
    let result: string | null | undefined;
    void getVideoChannelId("dQw4w9WgXcQ").then((value) => {
      settled = true;
      result = value;
    });

    await vi.advanceTimersByTimeAsync(7_999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    expect(settled).toBe(true);
    expect(result).toBeNull();
  });

  it("API 키가 없으면 네트워크 호출 없이 null", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getVideoChannelId } = await import("@/lib/youtube");

    expect(await getVideoChannelId("dQw4w9WgXcQ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("resolveYouTubeChannel", () => {
  it("channels.list 본문이 멈춰도 전체 8초 안에 null로 종료한다", async () => {
    vi.useFakeTimers();
    const stalledBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"items":['));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stalledBody, { status: 200 })),
    );
    const { resolveYouTubeChannel } = await importWithApiKey();

    let settled = false;
    let result: Awaited<ReturnType<typeof resolveYouTubeChannel>> | undefined;
    void resolveYouTubeChannel({ type: "handle", handle: "@jocoding" }).then((value) => {
      settled = true;
      result = value;
    });

    await vi.advanceTimersByTimeAsync(7_999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    expect(settled).toBe(true);
    expect(result).toBeNull();
  });
});
