/** Promise 작업 전체를 deadline으로 감싼다. 타임아웃 뒤 원 작업의 결과는 버린다. */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs = 8000,
  errorMessage = `operation timeout after ${timeoutMs}ms`,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * fetch의 응답 헤더 대기를 타임아웃으로 감싼다.
 *
 * Next.js는 fetch에 `signal`을 넘기면 데이터 캐시(`next.revalidate`)를 통째로 우회한다
 * (AbortSignal = 캐시 opt-out). 따라서 AbortController 대신 Promise.race로 감싸
 * 캐싱은 유지한 채 SSR 블로킹만 막는다. JSON 본문까지 같은 deadline이 필요하면
 * fetch와 파싱을 하나의 Promise로 묶어 `withTimeout`을 사용한다.
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit & { next?: { revalidate?: number } },
  timeoutMs = 8000,
): Promise<Response> {
  return withTimeout(
    fetch(url, init),
    timeoutMs,
    `fetch timeout after ${timeoutMs}ms: ${url}`,
  );
}
