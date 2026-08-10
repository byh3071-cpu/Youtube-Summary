import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { extractYouTubeVideoId, normalizeYouTubeUrl } from "@/lib/knowledge-capture";
import { getVideoSnippet } from "@/lib/youtube";
import { takeToken } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return Response.json({ error: "로그인해야 영상 정보를 확인할 수 있어요." }, { status: 401 });
  const rawUrl = new URL(request.url).searchParams.get("url")?.slice(0, 4_000) ?? "";
  const videoId = extractYouTubeVideoId(rawUrl);
  const sourceUrl = normalizeYouTubeUrl(rawUrl);
  if (!videoId || !sourceUrl) return Response.json({ error: "지원하는 YouTube 영상 URL이 아니에요." }, { status: 400 });
  const rateLimit = takeToken(`knowledge-preview:${user.id}`, 20, 60_000);
  if (!rateLimit.ok) {
    return Response.json(
      { error: "영상 확인 요청이 너무 잦아요. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }
  const snippet = await getVideoSnippet(videoId);
  return Response.json({
    videoId,
    sourceUrl,
    title: snippet?.title ?? "YouTube 영상",
    channelName: snippet?.channelName ?? null,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  }, { headers: { "Cache-Control": "private, max-age=300" } });
}
