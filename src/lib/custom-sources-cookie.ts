import type { FeedSource } from "./sources";

export const CUSTOM_SOURCES_COOKIE_NAME = "focus_feed_sources";
export const CUSTOM_SOURCES_MAX_AGE = 60 * 60 * 24 * 365; // 1년

export function filterValidSources(parsed: unknown): FeedSource[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is FeedSource =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as FeedSource).id === "string" &&
      typeof (item as FeedSource).name === "string" &&
      (item as FeedSource).type === "YouTube" &&
      typeof (item as FeedSource).category === "string"
  );
}

/**
 * 쿠키 값에서 커스텀 소스 목록을 파싱한다.
 * 과거 클라이언트가 직접 쓴 encodeURIComponent 형식과
 * 서버(Set-Cookie)가 쓴 plain JSON 형식을 모두 허용한다.
 */
export function getCustomSourcesFromCookie(cookieValue: string | undefined): FeedSource[] {
  if (!cookieValue) return [];
  const raw = cookieValue.trim();
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // %가 들어간 plain JSON이면 decode가 실패할 수 있음 — raw로 시도
  }
  for (const candidate of candidates) {
    try {
      const list = filterValidSources(JSON.parse(candidate));
      if (list.length > 0) return list;
    } catch {
      // 다음 후보로
    }
  }
  return [];
}

/** 쿠키에 저장할 최소 형태 (아바타 URL 등 부피 큰 필드는 제외) */
export function compactCustomSources(
  sources: FeedSource[],
): Pick<FeedSource, "id" | "name" | "type" | "category">[] {
  return sources.map(({ id, name, type, category }) => ({ id, name, type, category }));
}

/** 가져오기 시 기존 목록과 합칠 때, id 기준 중복 제거 (기존 유지 + 새 항목만 추가) */
export function mergeCustomSources(existing: FeedSource[], incoming: FeedSource[]): FeedSource[] {
  const idSet = new Set(existing.map((s) => s.id));
  const added = incoming.filter((s) => typeof s?.id === "string" && !idSet.has(s.id));
  return [...existing, ...added];
}

/**
 * 숨긴 기본 채널 ID 목록 쿠키.
 * 기본 채널은 코드 상수라 삭제가 불가능하므로, 병합 시 빼기 집합으로 쓴다.
 */
export const HIDDEN_SOURCES_COOKIE_NAME = "focus_feed_hidden";

/**
 * 소스 쿠키가 "누구의 DB 미러인지" 표시하는 마커 (user id).
 * - 마커 == 현재 유저: 쿠키는 미러 — DB가 단일 진실, 쿠키→DB push 금지
 *   (낡은 미러를 union으로 되밀면 다른 기기에서 지운 채널이 부활한다)
 * - 마커 없음: 비로그인 시절 데이터 — 로그인 동기화 때 1회 DB로 push
 * - 마커 != 현재 유저: 이전 계정 잔재 — 버리고 현재 유저 DB로 교체 (계정 오염 방지)
 */
export const SYNC_OWNER_COOKIE_NAME = "focus_feed_sync_owner";

const HIDDEN_CHANNEL_ID_REGEX = /^UC[\w-]{22}$/;

export function getHiddenSourceIdsFromCookie(cookieValue: string | undefined): string[] {
  if (!cookieValue) return [];
  const raw = cookieValue.trim();
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // plain JSON에 %가 있으면 decode 실패 — raw로 시도
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) {
        const ids = parsed.filter(
          (v): v is string => typeof v === "string" && HIDDEN_CHANNEL_ID_REGEX.test(v),
        );
        return [...new Set(ids)];
      }
    } catch {
      // 다음 후보로
    }
  }
  return [];
}
