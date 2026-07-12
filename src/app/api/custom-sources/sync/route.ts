import { cookies } from "next/headers";
import { filterValidSources } from "@/lib/custom-sources-cookie";
import {
  DEFAULT_YOUTUBE_SOURCE_IDS,
  fetchDbHiddenIds,
  fetchDbSources,
  getAuthedSupabase,
  hideDefaultInDb,
  insertSourceToDb,
  setCustomSourcesCookie,
  setHiddenSourcesCookie,
  setSyncOwnerCookie,
} from "@/lib/custom-sources-server";

export const dynamic = "force-dynamic";

const CHANNEL_ID_REGEX = /^UC[\w-]{22}$/;

/**
 * 로그인 세션의 쿠키↔DB 동기화 (CustomSourcesSync 전용).
 *
 * 결함 B(삭제 부활) 근치의 핵심: 예전 union 동기화는 낡은 쿠키의 항목을 DB로
 * 되밀어 다른 기기에서 지운 채널을 부활시켰다. 여기서는 DB를 단일 진실로 삼고
 * 쿠키를 DB 미러로 통째 교체한다. 쿠키→DB push는 클라이언트가 "비로그인 시절
 * 데이터"라고 판단해 body로 넘긴 항목만, 멱등(insert + 중복 무시)으로 수행한다
 * (멀티탭 SIGNED_IN 브로드캐스트로 중복 실행돼도 안전).
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const auth = await getAuthedSupabase(cookieStore);
  if (!auth) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { localSources?: unknown; localHidden?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const pendingSources = filterValidSources(body.localSources).filter(
    (s) => !DEFAULT_YOUTUBE_SOURCE_IDS.has(s.id),
  );
  const pendingHidden = (Array.isArray(body.localHidden) ? body.localHidden : []).filter(
    (id): id is string =>
      typeof id === "string" && CHANNEL_ID_REGEX.test(id) && DEFAULT_YOUTUBE_SOURCE_IDS.has(id),
  );

  for (const src of pendingSources) {
    await insertSourceToDb(auth, {
      id: src.id,
      name: src.name,
      category: src.category,
      avatarUrl: src.avatarUrl,
    });
  }
  for (const id of pendingHidden) {
    await hideDefaultInDb(auth, id);
  }

  const [dbSources, dbHidden] = await Promise.all([
    fetchDbSources(auth),
    fetchDbHiddenIds(auth),
  ]);
  if (dbSources === null || dbHidden === null) {
    // DB 조회 실패 시 쿠키를 건드리지 않는다 — 미러를 빈 목록으로 덮으면 안 됨
    return Response.json({ error: "DB 조회 실패" }, { status: 502 });
  }

  const cookieStored = setCustomSourcesCookie(cookieStore, dbSources);
  setHiddenSourcesCookie(cookieStore, dbHidden);
  setSyncOwnerCookie(cookieStore, auth.userId);

  return Response.json({ ok: true, sources: dbSources, hiddenIds: dbHidden, cookieStored });
}
