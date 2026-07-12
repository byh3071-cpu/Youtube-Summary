import type { cookies } from "next/headers";
import {
  getCurrentUserFromCookies,
  createServerSupabaseFromCookies,
} from "@/lib/supabase-server-cookies";
import type { Database } from "@/lib/supabase-server";
import {
  CUSTOM_SOURCES_COOKIE_NAME,
  CUSTOM_SOURCES_MAX_AGE,
  HIDDEN_SOURCES_COOKIE_NAME,
  SYNC_OWNER_COOKIE_NAME,
  getCustomSourcesFromCookie,
  getHiddenSourceIdsFromCookie,
  compactCustomSources,
} from "@/lib/custom-sources-cookie";
import { defaultSources, type FeedSource } from "@/lib/sources";

/** 숨김(삭제) 대상이 될 수 있는 기본 YouTube 채널 ID 집합 */
export const DEFAULT_YOUTUBE_SOURCE_IDS = new Set(
  defaultSources.filter((s) => s.type === "YouTube").map((s) => s.id),
);

/**
 * 브라우저 쿠키 1개 한도(이름+값 4096B)를 넘기지 않기 위한 저장 크기 예산.
 * Set-Cookie는 값을 percent-encoding해 저장하므로(한글은 글자당 최대 9B로 팽창)
 * 직렬화 문자열 길이가 아니라 인코딩 후 바이트 기준으로 판정해야 한다 —
 * 한도를 넘긴 Set-Cookie는 브라우저가 통째로 버려 조용한 유실이 된다.
 */
const COOKIE_NAME_PLUS_VALUE_BYTE_LIMIT = 4000;

export type MutableCookieStore = Awaited<ReturnType<typeof cookies>>;

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: CUSTOM_SOURCES_MAX_AGE,
  sameSite: "lax" as const,
};

/**
 * 커스텀 소스 쿠키를 서버에서 직접 굽는다 (단일 쓰기 경로).
 * - JS(document.cookie)로 쓴 쿠키는 iOS Safari ITP가 만료를 7일로 강제 단축하지만
 *   서버 Set-Cookie는 제한을 받지 않아 1년 만료가 유지된다.
 * @returns 쿠키 저장 성공 여부 (용량 초과 시 false)
 */
export function setCustomSourcesCookie(
  cookieStore: MutableCookieStore,
  sources: FeedSource[],
): boolean {
  const value = JSON.stringify(compactCustomSources(sources));
  const storedBytes = CUSTOM_SOURCES_COOKIE_NAME.length + encodeURIComponent(value).length;
  if (storedBytes > COOKIE_NAME_PLUS_VALUE_BYTE_LIMIT) return false;
  cookieStore.set(CUSTOM_SOURCES_COOKIE_NAME, value, COOKIE_OPTIONS);
  return true;
}

/** 숨김 ID 쿠키 (기본 채널 최대 수 × 24자라 예산 걱정 없음) */
export function setHiddenSourcesCookie(cookieStore: MutableCookieStore, ids: string[]): void {
  cookieStore.set(HIDDEN_SOURCES_COOKIE_NAME, JSON.stringify([...new Set(ids)]), COOKIE_OPTIONS);
}

/** 소스 쿠키의 소유자 마커 — 의미는 SYNC_OWNER_COOKIE_NAME 주석 참조 */
export function setSyncOwnerCookie(cookieStore: MutableCookieStore, userId: string): void {
  cookieStore.set(SYNC_OWNER_COOKIE_NAME, userId, COOKIE_OPTIONS);
}

export function readCookieSources(cookieStore: MutableCookieStore): FeedSource[] {
  return getCustomSourcesFromCookie(cookieStore.get(CUSTOM_SOURCES_COOKIE_NAME)?.value);
}

export function readHiddenIds(cookieStore: MutableCookieStore): string[] {
  return getHiddenSourceIdsFromCookie(cookieStore.get(HIDDEN_SOURCES_COOKIE_NAME)?.value);
}

export type AuthedClient = {
  supabase: NonNullable<ReturnType<typeof createServerSupabaseFromCookies>>;
  userId: string;
};

/** 로그인 사용자면 supabase 클라이언트와 userId를, 아니면 null (getUser 1회만 호출) */
export async function getAuthedSupabase(
  cookieStore: MutableCookieStore,
): Promise<AuthedClient | null> {
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return null;
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) return null;
  return { supabase, userId: user.id };
}

/** custom_sources insert — 중복(23505)은 성공 취급 (멱등) */
export async function insertSourceToDb(
  auth: AuthedClient,
  source: { id: string; name: string; category: string; avatarUrl?: string },
): Promise<boolean> {
  const row: Database["public"]["Tables"]["custom_sources"]["Insert"] = {
    user_id: auth.userId,
    source_id: source.id,
    name: source.name,
    category: source.category || "기타",
    avatar_url: source.avatarUrl ?? null,
  };
  const { error } = await auth.supabase.from("custom_sources").insert(row as never);
  if (error && error.code !== "23505") {
    console.error("[custom-sources] DB insert failed", error.message);
    return false;
  }
  return true;
}

/** 기본 채널 숨김을 DB에 기록 — 중복(23505)·테이블 미생성(42P01)은 조용히 통과 (멱등) */
export async function hideDefaultInDb(auth: AuthedClient, sourceId: string): Promise<void> {
  const row: Database["public"]["Tables"]["hidden_default_sources"]["Insert"] = {
    user_id: auth.userId,
    source_id: sourceId,
  };
  const { error } = await auth.supabase.from("hidden_default_sources").insert(row as never);
  if (error && error.code !== "23505" && error.code !== "42P01") {
    console.error("[custom-sources] hide insert failed", error.message);
  }
}

/** 기본 채널 숨김 해제 — 실제로 숨겨져 있었는지(행 삭제 여부) 반환 */
export async function unhideDefaultInDb(auth: AuthedClient, sourceId: string): Promise<boolean> {
  const { data, error } = await auth.supabase
    .from("hidden_default_sources")
    .delete()
    .eq("user_id", auth.userId)
    .eq("source_id", sourceId)
    .select("source_id");
  if (error) {
    if (error.code !== "42P01") {
      console.error("[custom-sources] unhide delete failed", error.message);
    }
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** DB의 커스텀 소스 목록 (동기화 응답·쿠키 미러 굽기용). 오류 시 null */
export async function fetchDbSources(auth: AuthedClient): Promise<FeedSource[] | null> {
  const { data, error } = await auth.supabase
    .from("custom_sources")
    .select("source_id, name, category, avatar_url")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[custom-sources] DB select failed", error.message);
    return null;
  }
  const rows = (data ?? []) as {
    source_id: string;
    name: string;
    category: string;
    avatar_url: string | null;
  }[];
  return rows.map((row) => ({
    id: row.source_id,
    name: row.name,
    type: "YouTube" as const,
    category: (row.category || "기타") as FeedSource["category"],
    avatarUrl: row.avatar_url ?? undefined,
  }));
}

/** DB의 숨김 ID 목록. 테이블 미생성(42P01)은 빈 목록, 그 외 오류는 null */
export async function fetchDbHiddenIds(auth: AuthedClient): Promise<string[] | null> {
  const { data, error } = await auth.supabase
    .from("hidden_default_sources")
    .select("source_id")
    .eq("user_id", auth.userId);
  if (error) {
    if (error.code === "42P01") return [];
    console.error("[custom-sources] hidden select failed", error.message);
    return null;
  }
  return ((data ?? []) as { source_id: string }[]).map((row) => row.source_id);
}
