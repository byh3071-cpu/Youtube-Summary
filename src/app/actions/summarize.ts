"use server";

import { GoogleGenAI } from "@google/genai";
import { YoutubeTranscript } from "youtube-transcript";
import { getVideoSnippet } from "@/lib/youtube";
import { getSupabaseForSummaries } from "@/lib/supabase-server";
import { getMergedFeed } from "@/lib/feed";
import type { FeedItem } from "@/types/feed";

async function summarizeWithGemini(prompt: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  return response.text ?? null;
}

type RankedItemPayload = {
  id: string;
  priority: number;
  score: number;
  why: string;
  action: string;
};

type RankingResult = {
  items: RankedItemPayload[];
};

async function getVideoContext(videoId: string): Promise<
  | { text: string; source: "자막" | "제목·설명" }
  | { error: string }
> {
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
    if (!text) {
      const fetched = await getVideoSnippet(videoId);
      if (fetched && (fetched.title || fetched.description)) {
        const snippetText = [fetched.title, fetched.description].filter(Boolean).join("\n\n").trim().slice(0, 8000);
        if (snippetText.length > 0) {
          text = snippetText;
          source = "제목·설명";
        }
      }
    }

    if (!text || text.length < 10) {
      return {
        error:
          "이 영상은 자막이 없고, 제목·설명으로도 요약하기 어렵습니다. 자막이 켜진 다른 영상을 선택해 주세요.",
      };
    }

    return { text, source };
  } catch (error) {
    console.error("getVideoContext Error:", error);
    return {
      error: "영상 내용을 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
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

  try {
    const ctx = await getVideoContext(videoId);
    if ("error" in ctx) {
      return { error: ctx.error };
    }

    const { text, source } = ctx;

    const prompt =
      source === "자막"
        ? `다음은 유튜브 영상의 자막입니다. 영상을 직접 보지 않고 라디오처럼 듣기만 하는 직장인을 위해, 불필요한 서론을 빼고 핵심 정보(팩트 단위) 3가지를 명확하게 요약해주세요.\n\n자막 내용:\n${text.slice(0, 15000)}`
        : `다음은 유튜브 영상의 제목과 설명입니다. 핵심 내용을 3줄 이내로 요약해주세요.\n\n내용:\n${text.slice(0, 15000)}`;

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

export async function summarizeInsightAction(videoId: string) {
  if (!process.env.GEMINI_API_KEY) {
    return { error: ".env.local 파일에 GEMINI_API_KEY 설정이 필요합니다." };
  }

  try {
    const ctx = await getVideoContext(videoId);
    if ("error" in ctx) {
      return { error: ctx.error };
    }

    const { text } = ctx;

    const prompt = `다음은 유튜브 영상의 내용입니다. 이 영상을 끝까지 본 시청자가
- 오늘 무엇을 배웠는지,
- 앞으로 일/공부/삶에 어떻게 적용하면 좋을지
정리할 수 있도록 도와주세요.

요구사항:
1) 영상에서 건질 만한 핵심 인사이트 3가지를, 한 줄씩 bullet로 정리
2) 한국 직장인/개발자/지식 노동자가 1주일 안에 실제로 시도해볼 수 있는 구체적인 액션 2가지를 bullet로 제안
3) 말투는 부담스럽지 않은 동료 느낌으로, 존댓말 한국어 사용

영상 내용:
${text.slice(0, 15000)}`;

    const insight = await summarizeWithGemini(prompt);
    if (!insight) {
      return { error: "인사이트 정리에 실패했습니다. 잠시 후 다시 시도해 주세요." };
    }

    return { insight: insight.trim() };
  } catch (error) {
    console.error("Summarize Insight Error:", error);
    return { error: "인사이트 정리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

function buildItemPayload(item: FeedItem, summaryText?: string | null): string {
  const base = {
    id: item.id || item.link,
    title: item.title,
    sourceName: item.sourceName,
    type: item.source,
    category: item.category ?? null,
    summary: summaryText || item.summary || null,
    link: item.link,
  };
  return JSON.stringify(base);
}

function safeParseRanking(text: string): RankingResult | null {
  const trimmed = text.trim();
  const jsonLike = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "");
  try {
    const parsed = JSON.parse(jsonLike) as RankingResult;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      items: parsed.items
        .filter(
          (it) =>
            typeof it.id === "string" &&
            typeof it.priority === "number" &&
            typeof it.score === "number" &&
            typeof it.why === "string" &&
            typeof it.action === "string",
        )
        .sort((a, b) => a.priority - b.priority),
    };
  } catch (e) {
    console.error("Failed to parse ranking JSON", e, text);
    return null;
  }
}

export async function rankFeedByGoalsAction(goals: string, limit: number = 20) {
  if (!process.env.GEMINI_API_KEY) {
    return { error: ".env.local 파일에 GEMINI_API_KEY 설정이 필요합니다." };
  }

  const goalText = goals.trim();
  if (!goalText) {
    return { error: "먼저 상단의 My Focus 영역에 목표/관심사를 입력해 주세요." };
  }

  const supabase = getSupabaseForSummaries();

  const { items } = await getMergedFeed();
  if (!items || items.length === 0) {
    return { error: "추천할 피드 아이템이 없습니다. 잠시 후 다시 시도해 주세요." };
  }

  const candidates = items.slice(0, limit);

  let summariesMap = new Map<string, string>();
  if (supabase) {
    const videoIds = candidates
      .filter((it) => it.source === "YouTube" && it.id)
      .map((it) => it.id as string);
    if (videoIds.length > 0) {
      const { data } = await supabase
        .from("summaries")
        .select("video_id, summary")
        .in("video_id", videoIds);
      if (data) {
        summariesMap = new Map(data.map((row) => [row.video_id, row.summary]));
      }
    }
  }

  const itemsPayload = candidates.map((item) =>
    buildItemPayload(item, item.id ? summariesMap.get(item.id) ?? null : null),
  );

  const systemGoal = `사용자의 목표/관심사:\n${goalText}\n\n이 사람은 1인 기업/프리랜서 시각에서, 오늘 당장 도움이 될 영상/글 위주로 우선순위를 정해줘야 합니다.`;

  const prompt = `
${systemGoal}

아래는 오늘 후보가 될 수 있는 콘텐츠 목록입니다. 각 JSON은 하나의 콘텐츠를 나타냅니다.

후보 목록:
${itemsPayload.join("\n")}

요구사항:
1) 사용자의 목표/관심사에 얼마나 직접적으로 도움이 되는지 기준으로 우선순위를 매기세요.
2) 가장 중요한 것부터 정렬해서 최대 ${Math.min(10, limit)}개만 선택하세요.
3) 각 항목에 대해:
   - priority: 1부터 시작하는 순위 (1이 가장 중요)
   - score: 1~100 사이 숫자로 중요도/적합도 점수
   - why: 이 사람이 이 콘텐츠를 지금 봐야 하는 이유 (한국어, 1~2문장)
   - action: 이 콘텐츠를 본 뒤 1주일 안에 실행해볼 수 있는 구체적인 액션 (한국어, 1문장)

반드시 아래 형식의 JSON만, 다른 자연어 설명이나 마크다운 없이 반환하세요:
{
  "items": [
    {
      "id": "<위 JSON 중 하나의 id>",
      "priority": 1,
      "score": 95,
      "why": "...",
      "action": "..."
    }
  ]
}
`;

  try {
    const raw = await summarizeWithGemini(prompt);
    if (!raw) {
      return { error: "우선순위 랭킹 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." };
    }
    const parsed = safeParseRanking(raw);
    if (!parsed) {
      return { error: "AI 응답을 해석하는 데 실패했습니다. 잠시 후 다시 시도해 주세요." };
    }

    const byId = new Map<string, FeedItem>();
    for (const item of candidates) {
      const key = item.id || item.link;
      byId.set(key, item);
    }

    const ranked = parsed.items
      .map((r) => {
        const original = byId.get(r.id);
        if (!original) return null;
        return {
          item: original,
          priority: r.priority,
          score: r.score,
          why: r.why,
          action: r.action,
        };
      })
      .filter(Boolean) as {
      item: FeedItem;
      priority: number;
      score: number;
      why: string;
      action: string;
    }[];

    if (ranked.length === 0) {
      return { error: "사용자 목표/관심사와 잘 맞는 추천을 찾지 못했습니다." };
    }

    return { ranked };
  } catch (error) {
    console.error("rankFeedByGoalsAction Error:", error);
    return { error: "AI 기반 추천 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
