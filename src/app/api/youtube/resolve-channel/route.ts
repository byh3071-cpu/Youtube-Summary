import { NextResponse } from "next/server";
import { parseYouTubeChannelInput } from "@/lib/youtube-channel-parse";
import { resolveYouTubeChannel } from "@/lib/youtube";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { input?: string };
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (!input) {
      return NextResponse.json({ error: "input 필요" }, { status: 400 });
    }

    const parsed = parseYouTubeChannelInput(input);
    if (!parsed) {
      return NextResponse.json(
        { error: "채널 URL 또는 ID를 입력해 주세요. 예: youtube.com/@조코딩 또는 UC..." },
        { status: 400 }
      );
    }

    const resolved = await resolveYouTubeChannel(parsed);
    if (!resolved) {
      return NextResponse.json(
        { error: "채널을 찾을 수 없습니다. URL·핸들·채널 ID를 확인해 주세요." },
        { status: 404 }
      );
    }

    return NextResponse.json(resolved);
  } catch {
    return NextResponse.json({ error: "처리 중 오류" }, { status: 500 });
  }
}
