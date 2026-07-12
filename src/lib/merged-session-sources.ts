import { cookies } from "next/headers";
import { defaultSources, type FeedSource } from "@/lib/sources";
import {
  getCustomSourcesFromCookie,
  getHiddenSourceIdsFromCookie,
  mergeCustomSources,
  CUSTOM_SOURCES_COOKIE_NAME,
  HIDDEN_SOURCES_COOKIE_NAME,
  SYNC_OWNER_COOKIE_NAME,
} from "@/lib/custom-sources-cookie";
import {
  getCurrentUserFromCookies,
  getCustomSourcesFromDb,
  getHiddenSourceIdsFromDb,
} from "@/lib/supabase-server-cookies";
import type { CookieStore } from "@/lib/supabase-server-cookies";

const DEFAULT_SOURCE_IDS = new Set(defaultSources.map((s) => s.id));

/**
 * 병합 = (기본 소스 − 숨긴 기본 채널) + 커스텀.
 * - RSS 기본 소스는 숨김 대상이 아니므로 항상 유지된다 (숨김 ID는 UC 형식만).
 * - 커스텀에 기본 채널 id가 섞인 레거시 데이터는 표시 중복·숨김 무력화를 막기 위해 버린다.
 */
function buildMergedSources(custom: FeedSource[], hiddenIds: string[]): FeedSource[] {
  const hidden = new Set(hiddenIds);
  const visibleDefaults = defaultSources.filter((s) => !hidden.has(s.id));
  const extra = custom.filter((c) => !DEFAULT_SOURCE_IDS.has(c.id));
  return [...visibleDefaults, ...extra];
}

interface SessionSourceState {
  custom: FeedSource[];
  hiddenIds: string[];
}

/**
 * 쿠키·DB에서 커스텀/숨김 목록을 읽는다. 소유자 마커(SYNC_OWNER_COOKIE_NAME) 기준:
 * - 비로그인: 쿠키가 진실.
 * - 마커 == 유저: 쿠키는 DB 미러 — DB가 진실, 조회 실패 시에만 쿠키 폴백.
 * - 마커 != 유저: 이전 계정 잔재 — 쿠키 무시, DB만.
 * - 마커 없음: 비로그인 시절 데이터 — 클라이언트 동기화가 push할 때까지 합집합으로 표시.
 */
async function getSessionSourceState(): Promise<SessionSourceState> {
  const cookieStore = await cookies();
  const cookieCustom = getCustomSourcesFromCookie(
    cookieStore.get(CUSTOM_SOURCES_COOKIE_NAME)?.value,
  );
  const cookieHidden = getHiddenSourceIdsFromCookie(
    cookieStore.get(HIDDEN_SOURCES_COOKIE_NAME)?.value,
  );

  const user = await getCurrentUserFromCookies(cookieStore as CookieStore);
  if (!user) {
    return { custom: cookieCustom, hiddenIds: cookieHidden };
  }

  const [dbCustom, dbHidden] = await Promise.all([
    getCustomSourcesFromDb(cookieStore as CookieStore),
    getHiddenSourceIdsFromDb(cookieStore as CookieStore),
  ]);

  const owner = cookieStore.get(SYNC_OWNER_COOKIE_NAME)?.value;
  if (owner === user.id) {
    return {
      custom: dbCustom ?? cookieCustom,
      hiddenIds: dbHidden ?? cookieHidden,
    };
  }
  if (owner) {
    // 다른 계정의 잔재 쿠키 — 오염 방지를 위해 무시
    return { custom: dbCustom ?? [], hiddenIds: dbHidden ?? [] };
  }
  // 비로그인 시절 쿠키 — DB로 push되기 전까지는 양쪽 합집합으로 보여준다
  return {
    custom: mergeCustomSources(cookieCustom, dbCustom ?? []),
    hiddenIds: [...new Set([...cookieHidden, ...(dbHidden ?? [])])],
  };
}

/** 숨김을 반영한 병합 소스 목록 (홈·피드 Q&A·트렌드 페이지 등 공통) */
export async function getSessionSourcesBundle(): Promise<{ mergedSources: FeedSource[] }> {
  const { custom, hiddenIds } = await getSessionSourceState();
  return { mergedSources: buildMergedSources(custom, hiddenIds) };
}

export async function getSessionMergedSources(): Promise<FeedSource[]> {
  return (await getSessionSourcesBundle()).mergedSources;
}
