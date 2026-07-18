import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  checkUsageLimit: vi.fn(),
  incrementUsage: vi.fn(),
  guardRateLimit: vi.fn(),
  getVideoContext: vi.fn(),
  getSupabaseForSummaries: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/plan", () => ({
  checkUsageLimit: mocks.checkUsageLimit,
  incrementUsage: mocks.incrementUsage,
}));
vi.mock("@/lib/gemini-rate-limit", () => ({
  guardGeminiActionRateLimit: mocks.guardRateLimit,
}));
vi.mock("@/lib/video-context", () => ({
  getVideoContext: mocks.getVideoContext,
}));
vi.mock("@/lib/supabase-server", () => ({
  getSupabaseForSummaries: mocks.getSupabaseForSummaries,
}));

import { summarizeVideoAction } from "@/app/actions/summarize";

describe("summarizeVideoAction authentication gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ getAll: () => [] });
  });

  it("비로그인이면 API 설정·레이트리밋·영상 처리보다 먼저 로그인 오류를 반환한다", async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    mocks.checkUsageLimit.mockResolvedValue({
      allowed: false,
      error: "로그인이 필요합니다.",
    });

    try {
      await expect(summarizeVideoAction("video-1")).resolves.toEqual({
        error: "로그인이 필요합니다.",
      });
      expect(mocks.guardRateLimit).not.toHaveBeenCalled();
      expect(mocks.getVideoContext).not.toHaveBeenCalled();
      expect(mocks.getSupabaseForSummaries).not.toHaveBeenCalled();
    } finally {
      if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousKey;
    }
  });
});
