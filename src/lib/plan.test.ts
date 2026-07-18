import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserFromCookies: vi.fn(),
  getServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
}));
vi.mock("@/lib/supabase-server", () => ({
  getServerSupabaseClient: mocks.getServerSupabaseClient,
}));

import { checkUsageLimit } from "@/lib/plan";

describe("checkUsageLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("비로그인 사용자의 AI 요약 요청을 DB 조회 전에 차단한다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);

    const result = await checkUsageLimit({ getAll: () => [] }, "summary");

    expect(result).toEqual({ allowed: false, error: "로그인이 필요합니다." });
    expect(mocks.getServerSupabaseClient).not.toHaveBeenCalled();
  });
});
