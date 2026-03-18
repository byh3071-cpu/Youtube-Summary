import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey.trim() === "your_youtube_api_key_here") {
    return NextResponse.json({ status: "missing", message: "YOUTUBE_API_KEY가 설정되지 않았거나 플레이스홀더입니다." });
  }

  const playlistId = "UUVsmLiPbyoHJ9OS8KmVaLgQ";
  const params = new URLSearchParams({ part: "snippet", playlistId, maxResults: "1", key: apiKey });

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
      { cache: "no-store" }
    );
    const body = await res.text();
    return NextResponse.json({
      httpStatus: res.status,
      ok: res.ok,
      keyPrefix: apiKey.slice(0, 8) + "...",
      response: body.slice(0, 800),
    });
  } catch (err) {
    return NextResponse.json({ status: "network_error", error: String(err) }, { status: 500 });
  }
}
