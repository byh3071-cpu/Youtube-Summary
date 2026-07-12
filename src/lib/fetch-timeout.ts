/**
 * fetch를 타임아웃으로 감싼다.
 *
 * Next.js는 fetch에 `signal`을 넘기면 데이터 캐시(`next.revalidate`)를 통째로 우회한다
 * (AbortSignal = 캐시 opt-out). 따라서 AbortController 대신 Promise.race로 감싸
 * 캐싱은 유지한 채 SSR 블로킹만 막는다. 타임아웃 시 원 요청은 백그라운드로 계속되지만
 * 결과는 버려지며, 호출부의 try/catch가 빈 결과로 폴백한다.
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit & { next?: { revalidate?: number } },
  timeoutMs = 8000,
): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`fetch timeout after ${timeoutMs}ms: ${url}`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([fetch(url, init), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
