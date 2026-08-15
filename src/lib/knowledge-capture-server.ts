import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildKnowledgeCaptureMetadata,
  isKnowledgeJobsUnavailableError,
  type KnowledgeJobSummary,
} from "@/lib/knowledge-capture";
import type { Database } from "@/lib/supabase-server";
import { getVideoSnippet } from "@/lib/youtube";

type JobSummaryRow = Pick<
  Database["public"]["Tables"]["knowledge_jobs"]["Row"],
  "id" | "video_id" | "status" | "capture_ready" | "created_at" | "updated_at"
>;

export type KnowledgeCaptureFailureCode =
  | "NORMALIZATION_FAILED"
  | "QUEUE_UNAVAILABLE"
  | "QUEUE_LIMIT"
  | "ENQUEUE_FAILED"
  | "EMPTY_RESPONSE"
  | "ENRICH_METADATA_FAILED"
  | "ENRICH_UNAVAILABLE"
  | "ENRICH_FAILED"
  | "ENRICH_EMPTY";

export type KnowledgeCaptureResult =
  | { ok: true; job: KnowledgeJobSummary; created: boolean }
  | {
      ok: false;
      code: KnowledgeCaptureFailureCode;
      status: 409 | 429 | 500 | 503;
      job?: KnowledgeJobSummary;
      created?: boolean;
      retryAfter?: string;
      logMessage?: string;
    };

export function serializeKnowledgeJob(row: JobSummaryRow): KnowledgeJobSummary {
  return {
    id: row.id,
    videoId: row.video_id,
    status: row.status,
    captureReady: row.capture_ready,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 일반 캡처와 제한된 카나리 캡처가 공유하는 enqueue→metadata enrich 계약.
 * 브라우저용 문구는 호출 route가 결정하며, DB 원문 오류는 logMessage로만 돌려준다.
 */
export async function enqueueAndEnrichKnowledgeCapture(
  supabase: SupabaseClient<Database>,
  input: {
    sourceUrl: string;
    title: string | null;
    channelName: string | null;
    metadata: Record<string, unknown>;
    enrichExisting?: boolean;
  },
): Promise<KnowledgeCaptureResult> {
  const requested = buildKnowledgeCaptureMetadata(input);
  if (!requested) {
    return { ok: false, code: "NORMALIZATION_FAILED", status: 500 };
  }

  let enqueueResponse;
  try {
    enqueueResponse = await supabase.rpc("enqueue_knowledge_job", {
      p_source_type: "youtube",
      p_source_key: requested.videoId,
      p_source_url: requested.sourceUrl,
      p_video_id: requested.videoId,
      p_title: requested.title,
      p_channel_name: requested.channelName,
      p_source_guide: requested.sourceGuide,
      p_metadata: input.metadata,
    });
  } catch (error) {
    return {
      ok: false,
      code: "ENQUEUE_FAILED",
      status: 500,
      logMessage: error instanceof Error ? error.message : "enqueue request failed",
    };
  }
  const { data, error } = enqueueResponse;

  if (error) {
    if (isKnowledgeJobsUnavailableError(error)) {
      return {
        ok: false,
        code: "QUEUE_UNAVAILABLE",
        status: 503,
        logMessage: error.message,
      };
    }
    if (error.code === "P0001" && error.message.includes("knowledge_queue_")) {
      return { ok: false, code: "QUEUE_LIMIT", status: 429 };
    }
    return {
      ok: false,
      code: "ENQUEUE_FAILED",
      status: 500,
      logMessage: error.message,
    };
  }

  const job = data?.[0];
  if (!job) return { ok: false, code: "EMPTY_RESPONSE", status: 500 };

  // 카나리 호출은 이미 존재하던 작업을 clean 표본으로 바꾸거나 보강하지 않는다.
  if (!job.created && input.enrichExisting === false) {
    return { ok: true, job: serializeKnowledgeJob(job), created: false };
  }

  let responseJob: JobSummaryRow = job;
  if (!job.capture_ready) {
    const snippet = await getVideoSnippet(requested.videoId);
    const enriched = buildKnowledgeCaptureMetadata({
      sourceUrl: requested.sourceUrl,
      title: snippet?.title ?? requested.title,
      channelName: snippet?.channelName ?? requested.channelName,
      description: snippet?.description,
    });
    if (!enriched) {
      return {
        ok: false,
        code: "ENRICH_METADATA_FAILED",
        status: 500,
        job: serializeKnowledgeJob(job),
        created: job.created,
      };
    }

    let enrichResponse;
    try {
      enrichResponse = await supabase.rpc("enrich_knowledge_job", {
        p_job_id: job.id,
        p_title: enriched.title,
        p_channel_name: enriched.channelName,
        p_source_guide: enriched.sourceGuide,
      });
    } catch (error) {
      return {
        ok: false,
        code: "ENRICH_FAILED",
        status: 500,
        job: serializeKnowledgeJob(job),
        created: job.created,
        logMessage: error instanceof Error ? error.message : "enrich request failed",
      };
    }
    const { data: enrichedRows, error: enrichError } = enrichResponse;
    if (enrichError) {
      const unavailable = isKnowledgeJobsUnavailableError(enrichError);
      return {
        ok: false,
        code: unavailable ? "ENRICH_UNAVAILABLE" : "ENRICH_FAILED",
        status: unavailable ? 503 : 500,
        job: serializeKnowledgeJob(job),
        created: job.created,
        ...(unavailable ? { retryAfter: "5" } : {}),
        logMessage: enrichError.message,
      };
    }
    if (!enrichedRows?.[0]) {
      return {
        ok: false,
        code: "ENRICH_EMPTY",
        status: 409,
        job: serializeKnowledgeJob(job),
        created: job.created,
      };
    }
    responseJob = enrichedRows[0];
  }

  return { ok: true, job: serializeKnowledgeJob(responseJob), created: job.created };
}

/**
 * Clean canaries use a dedicated service-role RPC so capture readiness and
 * reserved hold/no-retry metadata are committed atomically. Existing jobs are
 * returned byte-for-byte by the database and are never promoted into a run.
 */
export async function enqueueKnowledgeCanaryCapture(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    runId: string;
    sourceUrl: string;
    title: string;
    channelName: string | null;
  },
): Promise<KnowledgeCaptureResult> {
  const requested = buildKnowledgeCaptureMetadata(input);
  if (!requested) {
    return { ok: false, code: "NORMALIZATION_FAILED", status: 500 };
  }

  let enqueueResponse;
  try {
    enqueueResponse = await supabase.rpc("enqueue_knowledge_canary_job", {
      p_user_id: input.userId,
      p_run_id: input.runId,
      p_source_type: "youtube",
      p_source_key: requested.videoId,
      p_source_url: requested.sourceUrl,
      p_video_id: requested.videoId,
      p_title: requested.title,
      p_channel_name: requested.channelName,
      p_source_guide: requested.sourceGuide,
    });
  } catch (error) {
    return {
      ok: false,
      code: "ENQUEUE_FAILED",
      status: 500,
      logMessage: error instanceof Error ? error.message : "canary enqueue request failed",
    };
  }
  const { data, error } = enqueueResponse;

  if (error) {
    if (isKnowledgeJobsUnavailableError(error)) {
      return {
        ok: false,
        code: "QUEUE_UNAVAILABLE",
        status: 503,
        logMessage: error.message,
      };
    }
    if (error.code === "P0001" && error.message.includes("knowledge_queue_")) {
      return { ok: false, code: "QUEUE_LIMIT", status: 429 };
    }
    return {
      ok: false,
      code: "ENQUEUE_FAILED",
      status: 500,
      logMessage: error.message,
    };
  }

  const job = data?.[0];
  if (!job) return { ok: false, code: "EMPTY_RESPONSE", status: 500 };
  if (job.created && !job.capture_ready) {
    return {
      ok: false,
      code: "ENRICH_EMPTY",
      status: 409,
      job: serializeKnowledgeJob(job),
      created: true,
    };
  }
  return { ok: true, job: serializeKnowledgeJob(job), created: job.created };
}
