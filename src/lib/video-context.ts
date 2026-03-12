import { YoutubeTranscript } from "youtube-transcript";
import { getVideoSnippet } from "@/lib/youtube";

export type VideoContextResult =
  | { text: string; source: "자막" | "제목·설명" }
  | { error: string };

/**
 * YouTube 영상의 텍스트 컨텍스트를 가져옵니다.
 * 1차: 자막 시도, 2차: 제목·설명 폴백.
 */
export async function getVideoContext(
  videoId: string,
): Promise<VideoContextResult> {
  let text: string | null = null;
  let source: "자막" | "제목·설명" = "자막";

  try {
    // 1. 자막 시도
    try {
      const transcriptTextList =
        await YoutubeTranscript.fetchTranscript(videoId);
      text =
        transcriptTextList
          .map((t) => t.text)
          .join(" ")
          .trim() || null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("Transcript is disabled") ||
        msg.includes("transcript")
      ) {
        text = null;
      } else {
        throw e;
      }
    }

    // 2. 자막이 없으면 제목·설명으로 폴백
    if (!text) {
      const fetched = await getVideoSnippet(videoId);
      if (fetched && (fetched.title || fetched.description)) {
        const snippetText = [fetched.title, fetched.description]
          .filter(Boolean)
          .join("\n\n")
          .trim()
          .slice(0, 8000);
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
      error:
        "영상 내용을 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
