import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getVideoSnippet: vi.fn() }));
vi.mock("@/lib/youtube", () => ({ getVideoSnippet: mocks.getVideoSnippet }));

import {
  enqueueAndEnrichKnowledgeCapture,
  enqueueKnowledgeCanaryCapture,
} from "./knowledge-capture-server";

const PENDING_JOB = {
  id: "job-1",
  video_id: "abc_DEF-123",
  status: "queued",
  capture_ready: false,
  created_at: "2026-08-14T00:00:00.000Z",
  updated_at: "2026-08-14T00:00:00.000Z",
};
const READY_JOB = { ...PENDING_JOB, capture_ready: true };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getVideoSnippet.mockResolvedValue(null);
});

describe("enqueueAndEnrichKnowledgeCapture", () => {
  it("카나리는 기존 미완료 작업을 보강하거나 변경하지 않는다", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: [{ ...PENDING_JOB, created: false }], error: null }),
    };

    const result = await enqueueAndEnrichKnowledgeCapture(supabase as never, {
      sourceUrl: "https://www.youtube.com/watch?v=abc_DEF-123",
      title: "Canary",
      channelName: "Channel",
      metadata: { _canary_hold: true, _canary_no_retry: true },
      enrichExisting: false,
    });

    expect(result).toMatchObject({ ok: true, created: false, job: { id: "job-1", captureReady: false } });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.getVideoSnippet).not.toHaveBeenCalled();
  });

  it("일반 캡처는 기존 미완료 작업의 보강을 재개한다", async () => {
    const supabase = { rpc: vi.fn() };
    supabase.rpc
      .mockResolvedValueOnce({ data: [{ ...PENDING_JOB, created: false }], error: null })
      .mockResolvedValueOnce({ data: [READY_JOB], error: null });

    const result = await enqueueAndEnrichKnowledgeCapture(supabase as never, {
      sourceUrl: "https://www.youtube.com/watch?v=abc_DEF-123",
      title: "Capture",
      channelName: "Channel",
      metadata: { received_via: "focus-feed" },
    });

    expect(result).toMatchObject({ ok: true, created: false, job: { captureReady: true } });
    expect(mocks.getVideoSnippet).toHaveBeenCalledWith("abc_DEF-123");
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("DB 원문 오류는 브라우저 문구가 아니라 내부 logMessage로 분리한다", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "XX000", message: "sensitive database detail" },
      }),
    };

    const result = await enqueueAndEnrichKnowledgeCapture(supabase as never, {
      sourceUrl: "https://www.youtube.com/watch?v=abc_DEF-123",
      title: "Capture",
      channelName: null,
      metadata: {},
    });

    expect(result).toEqual({
      ok: false,
      code: "ENQUEUE_FAILED",
      status: 500,
      logMessage: "sensitive database detail",
    });
  });

  it("enqueue 뒤 enrich transport가 throw해도 생성된 job ID를 보존한다", async () => {
    const supabase = { rpc: vi.fn() };
    supabase.rpc
      .mockResolvedValueOnce({ data: [{ ...PENDING_JOB, created: true }], error: null })
      .mockRejectedValueOnce(new Error("network detail"));

    const result = await enqueueAndEnrichKnowledgeCapture(supabase as never, {
      sourceUrl: "https://www.youtube.com/watch?v=abc_DEF-123",
      title: "Capture",
      channelName: null,
      metadata: {},
    });

    expect(result).toMatchObject({
      ok: false,
      code: "ENRICH_FAILED",
      status: 500,
      created: true,
      job: { id: "job-1", captureReady: false },
      logMessage: "network detail",
    });
  });
});

describe("enqueueKnowledgeCanaryCapture", () => {
  it("uses the dedicated service-role RPC with explicit owner and run identity", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: [{ ...READY_JOB, created: true }], error: null }),
    };

    const result = await enqueueKnowledgeCanaryCapture(supabase as never, {
      userId: "8a805f4a-ab4c-475b-8b62-728df86f5ae7",
      runId: "a".repeat(64),
      sourceUrl: "https://www.youtube.com/watch?v=abc_DEF-123",
      title: "Canary",
      channelName: "Channel",
    });

    expect(result).toMatchObject({ ok: true, created: true, job: { captureReady: true } });
    expect(supabase.rpc).toHaveBeenCalledWith("enqueue_knowledge_canary_job", expect.objectContaining({
      p_user_id: "8a805f4a-ab4c-475b-8b62-728df86f5ae7",
      p_run_id: "a".repeat(64),
      p_source_key: "abc_DEF-123",
      p_source_url: "https://www.youtube.com/watch?v=abc_DEF-123",
    }));
    expect(supabase.rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_metadata");
    expect(mocks.getVideoSnippet).not.toHaveBeenCalled();
  });

  it("returns an existing job unchanged even when it is not capture-ready", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: [{ ...PENDING_JOB, created: false }], error: null }),
    };

    const result = await enqueueKnowledgeCanaryCapture(supabase as never, {
      userId: "8a805f4a-ab4c-475b-8b62-728df86f5ae7",
      runId: "b".repeat(64),
      sourceUrl: "https://youtu.be/abc_DEF-123",
      title: "Canary",
      channelName: null,
    });

    expect(result).toMatchObject({ ok: true, created: false, job: { captureReady: false } });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("fails closed if a newly created canary is not atomically capture-ready", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: [{ ...PENDING_JOB, created: true }], error: null }),
    };

    const result = await enqueueKnowledgeCanaryCapture(supabase as never, {
      userId: "8a805f4a-ab4c-475b-8b62-728df86f5ae7",
      runId: "c".repeat(64),
      sourceUrl: "https://youtu.be/abc_DEF-123",
      title: "Canary",
      channelName: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "ENRICH_EMPTY",
      status: 409,
      created: true,
      job: { captureReady: false },
    });
  });
});
