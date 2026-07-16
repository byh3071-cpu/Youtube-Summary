export const FREE_DAILY_SUMMARY = 5;
export const FREE_DAILY_INSIGHT = 3;
export const FREE_DAILY_FEED_QA = 5;
export const FREE_WEEKLY_BRIEFING = 1;

/**
 * 조회된 카운트로 한도 초과 여부를 판정한다.
 * DB 오류 시에는 fail-closed(차단)로 처리해 조회 실패가 무제한 허용으로 새지 않게 한다.
 */
export function evaluateUsageLimit(
  count: number,
  limit: number,
  dbError: boolean,
): { ok: false } | { ok: true; over: boolean } {
  if (dbError) return { ok: false };
  return { ok: true, over: count >= limit };
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKstDateString(date = new Date()): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 해당 KST 날짜가 속한 주의 월요일(YYYY-MM-DD) */
export function getKstWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
