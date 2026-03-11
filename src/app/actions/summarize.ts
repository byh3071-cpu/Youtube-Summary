"use server";

import { GoogleGenAI } from "@google/genai";
import { YoutubeTranscript } from "youtube-transcript";
import { getVideoSnippet } from "@/lib/youtube";
import { getSupabaseForSummaries } from "@/lib/supabase-server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function summarizeWithGemini(prompt: string): Promise<string | null> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  return response.text ?? null;
}

export async function summarizeVideoAction(videoId: string) {
  if (!process.env.GEMINI_API_KEY) {
    return { error: ".env.local 파일에 GEMINI_API_KEY 설정이 필요합니다." };
  }

  const supabase = getSupabaseForSummaries();

  // 0. Supabase 캐시 조회
  if (supabase) {
    const { data, error } = await supabase
      .from("summaries")
      .select("summary")
      .eq("video_id", videoId)
      .maybeSingle();

    if (!error && data?.summary) {
      return { summary: data.summary as string };
    }
  }

  let text: string | null = null;
  let source: "자막" | "제목·설명" = "자막";

  try {
    // 1. 자막 시도
    try {
      const transcriptTextList = await YoutubeTranscript.fetchTranscript(videoId);
      text = transcriptTextList.map((t) => t.text).join(" ").trim() || null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Transcript is disabled") || msg.includes("transcript")) {
        text = null;
      } else {
        throw e;
      }
    }

    // 2. 자막이 없으면 제목·설명으로 폴백
    let snippet: { title: string; description: string } | null = null;
    if (!text) {
      const fetched = await getVideoSnippet(videoId);
      if (fetched && (fetched.title || fetched.description)) {
        snippet = fetched;
        text = [fetched.title, fetched.description].filter(Boolean).join("\n\n").trim().slice(0, 8000);
        source = "제목·설명";
      }
    }

    if (!text || text.length < 10) {
      return {
        error:
          "이 영상은 자막이 없고, 제목·설명으로도 요약할 수 없습니다. 자막이 켜진 다른 영상을 선택해 주세요.",
      };
    }

    const prompt =
      source === "자막"
        ? `다음은 유튜브 영상의 자막입니다. 영상을 직접 보지 않고 라디오처럼 듣기만 하는 직장인을 위해, 불필요한 서론을 빼고 핵심 정보(팩트 단위) 3가지를 명확하게 요약해주세요.\n\n자막 내용:\n${text.slice(0, 15000)}`
        : `다음은 유튜브 영상의 제목과 설명입니다. 핵심 내용을 3줄 이내로 요약해주세요.\n\n제목:\n${snippet!.title.slice(0, 500)}\n\n설명:\n${(snippet!.description ?? "").slice(0, 12000)}`;

    const summary = await summarizeWithGemini(prompt);
    if (summary) {
      const final = source === "제목·설명" ? `(제목·설명 기반)\n\n${summary}` : summary;

      // 3. Supabase에 캐시 저장 (best-effort)
      if (supabase) {
        await supabase
          .from("summaries")
          .upsert(
            {
              video_id: videoId,
              summary: final,
              source,
            },
            { onConflict: "video_id" },
          );
      }

      return { summary: final };
    }
    return { error: "요약 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  } catch (error: unknown) {
    console.error("Summarize Error:", error);
    return { error: "요약 생성을 실패했습니다. 잠시 후 시도해주세요." };
  }
}
