import { cookies } from "next/headers";
import {
  getCurrentUserFromCookies,
  createServerSupabaseFromCookies,
} from "@/lib/supabase-server-cookies";
import { mergeCustomSources, filterValidSources } from "@/lib/custom-sources-cookie";
import {
  DEFAULT_YOUTUBE_SOURCE_IDS,
  getAuthedSupabase,
  hideDefaultInDb,
  insertSourceToDb,
  readCookieSources,
  readHiddenIds,
  setCustomSourcesCookie,
  setHiddenSourcesCookie,
  setSyncOwnerCookie,
  unhideDefaultInDb,
} from "@/lib/custom-sources-server";
import type { FeedSource } from "@/lib/sources";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    // 비로그인은 "빈 목록"이 아니라 "동기화 불가"로 구분해야
    // 클라이언트가 쿠키 소스를 DB에 무의미하게 push하지 않는다.
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("custom_sources")
    .select("source_id, name, category, avatar_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[GET /api/custom-sources]", error.message);
    return Response.json([]);
  }
  const rows = (data ?? []) as { source_id: string; name: string; category: string; avatar_url: string | null }[];
  const list = rows.map((row) => ({
    id: row.source_id,
    name: row.name,
    type: "YouTube" as const,
    category: row.category || "기타",
    avatarUrl: row.avatar_url ?? undefined,
  }));
  return Response.json(list);
}

/**
 * 채널 1개 추가: 쿠키는 항상(용량 내) 갱신, DB는 로그인 시에만 저장.
 * 숨겨둔 기본 채널을 다시 추가하면 커스텀 등록 대신 숨김 해제(복원)로 처리한다.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  let body: { sourceId?: string; name?: string; category?: string; avatarUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { sourceId, name, category, avatarUrl } = body;
  if (!sourceId || !name) {
    return Response.json({ error: "sourceId and name required" }, { status: 400 });
  }

  if (DEFAULT_YOUTUBE_SOURCE_IDS.has(sourceId)) {
    const hiddenCookie = readHiddenIds(cookieStore);
    const wasHiddenInCookie = hiddenCookie.includes(sourceId);
    if (wasHiddenInCookie) {
      setHiddenSourcesCookie(cookieStore, hiddenCookie.filter((id) => id !== sourceId));
    }
    const auth = await getAuthedSupabase(cookieStore);
    let wasHiddenInDb = false;
    if (auth) {
      wasHiddenInDb = await unhideDefaultInDb(auth, sourceId);
      setSyncOwnerCookie(cookieStore, auth.userId);
    }
    if (!wasHiddenInCookie && !wasHiddenInDb) {
      return Response.json({ error: "이미 목록에 있는 기본 채널입니다." }, { status: 409 });
    }
    return Response.json({ ok: true, restored: true, saved: !!auth, cookieStored: true });
  }

  const existing = readCookieSources(cookieStore);
  const newSource: FeedSource = {
    id: sourceId,
    name,
    type: "YouTube",
    category: (category || "기타") as FeedSource["category"],
    avatarUrl,
  };
  const merged = mergeCustomSources(existing, [newSource]);

  const cookieStored = setCustomSourcesCookie(cookieStore, merged);
  const auth = await getAuthedSupabase(cookieStore);
  const saved = auth
    ? await insertSourceToDb(auth, { id: sourceId, name, category: category ?? "기타", avatarUrl })
    : false;
  if (auth) setSyncOwnerCookie(cookieStore, auth.userId);

  if (!cookieStored && !saved) {
    return Response.json(
      { ok: false, error: "기기 저장 한도를 초과했습니다. 로그인하면 채널을 제한 없이 보관할 수 있어요." },
      { status: 413 },
    );
  }
  return Response.json({ ok: true, saved, cookieStored });
}

/** 채널 목록 일괄 병합 (가져오기·백업 복원용). 기본 채널 id는 커스텀 대신 숨김 해제로 처리 */
export async function PUT(request: Request) {
  const cookieStore = await cookies();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const incomingAll = filterValidSources(body);
  if (incomingAll.length === 0) {
    return Response.json({ error: "올바른 채널 목록 형식이 아닙니다." }, { status: 400 });
  }
  const incomingDefaults = incomingAll.filter((s) => DEFAULT_YOUTUBE_SOURCE_IDS.has(s.id));
  const incoming = incomingAll.filter((s) => !DEFAULT_YOUTUBE_SOURCE_IDS.has(s.id));

  const existing = readCookieSources(cookieStore);
  const merged = mergeCustomSources(existing, incoming);
  const cookieStored = setCustomSourcesCookie(cookieStore, merged);

  const auth = await getAuthedSupabase(cookieStore);

  // 가져온 목록에 기본 채널이 있으면 "보이는 상태"가 의도이므로 숨김을 푼다
  if (incomingDefaults.length > 0) {
    const hiddenCookie = readHiddenIds(cookieStore);
    const incomingDefaultIds = new Set(incomingDefaults.map((s) => s.id));
    setHiddenSourcesCookie(cookieStore, hiddenCookie.filter((id) => !incomingDefaultIds.has(id)));
    if (auth) {
      for (const s of incomingDefaults) {
        await unhideDefaultInDb(auth, s.id);
      }
    }
  }

  // 로그인 상태면 DB에 없는 항목을 채워 넣는다 (중복은 23505로 무시됨)
  let saved = 0;
  if (auth) {
    for (const src of merged) {
      const ok = await insertSourceToDb(auth, {
        id: src.id,
        name: src.name,
        category: src.category,
        avatarUrl: src.avatarUrl,
      });
      if (ok) saved += 1;
    }
    setSyncOwnerCookie(cookieStore, auth.userId);
  }

  // 쿠키도 못 쓰고 DB에도 못 넣었다면 아무 데도 저장되지 않은 것 — 거짓 성공 금지
  if (!cookieStored && !auth) {
    return Response.json(
      { ok: false, error: "기기 저장 한도를 초과했습니다. 로그인하면 채널을 제한 없이 보관할 수 있어요." },
      { status: 413 },
    );
  }

  return Response.json({ ok: true, count: merged.length, cookieStored, saved });
}

/**
 * 채널 제거. 기본 채널이면 숨김 목록에 추가(코드 상수라 행 삭제 불가),
 * 커스텀이면 쿠키·DB에서 제거.
 */
export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId");
  if (!sourceId) {
    return Response.json({ error: "sourceId required" }, { status: 400 });
  }

  if (DEFAULT_YOUTUBE_SOURCE_IDS.has(sourceId)) {
    const hidden = readHiddenIds(cookieStore);
    setHiddenSourcesCookie(cookieStore, [...hidden, sourceId]);
    const auth = await getAuthedSupabase(cookieStore);
    if (auth) {
      await hideDefaultInDb(auth, sourceId);
      setSyncOwnerCookie(cookieStore, auth.userId);
    }
    return Response.json({ ok: true, hidden: true });
  }

  const existing = readCookieSources(cookieStore);
  const cookieStored = setCustomSourcesCookie(
    cookieStore,
    existing.filter((s) => s.id !== sourceId),
  );

  const user = await getCurrentUserFromCookies(cookieStore);
  if (user) {
    const supabase = createServerSupabaseFromCookies(cookieStore);
    if (supabase) {
      const { error } = await supabase
        .from("custom_sources")
        .delete()
        .eq("user_id", user.id)
        .eq("source_id", sourceId);
      if (error) {
        console.error("[DELETE /api/custom-sources]", error.message);
        return Response.json({ error: error.message }, { status: 500 });
      }
    }
    setSyncOwnerCookie(cookieStore, user.id);
  }
  // 남은 목록이 여전히 예산 초과라 쿠키를 못 구우면(기존 초과 쿠키), 비로그인은 삭제가
  // 어디에도 반영되지 않은 것 — 거짓 성공 금지
  if (!cookieStored && !user) {
    return Response.json(
      { ok: false, error: "기기 저장 한도 때문에 삭제를 반영하지 못했습니다. 로그인하면 계정에 안전하게 보관됩니다." },
      { status: 413 },
    );
  }
  return Response.json({ ok: true });
}
