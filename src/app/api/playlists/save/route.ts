import { NextRequest, NextResponse } from "next/server";
import { savePlaylistAction } from "@/app/actions/playlists";
import type { RadioQueueItem } from "@/contexts/RadioQueueContext";

export async function POST(req: NextRequest) {
  try {
    const { items, title } = (await req.json()) as {
      items?: RadioQueueItem[];
      title?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "저장할 항목이 없습니다." },
        { status: 400 },
      );
    }

    const result = await savePlaylistAction(items, title);

    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/playlists/save error:", error);
    return NextResponse.json(
      { error: "플레이리스트 저장 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

