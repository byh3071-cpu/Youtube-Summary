/** Promise 작업 전체를 deadline으로 감싸고, 타임아웃 시 원 작업도 취소한다. */
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 8000,
  errorMessage = `operation timeout after ${timeoutMs}ms`,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(errorMessage);
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * fetch에 취소 신호를 전달해 응답 대기 자체를 타임아웃으로 중단한다.
 * 기존 호출자가 넘긴 신호도 보존하며 Next.js의 `next.revalidate` 옵션과 함께 사용한다.
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit & { next?: { revalidate?: number } },
  timeoutMs = 8000,
): Promise<Response> {
  return withTimeout(
    (timeoutSignal) => {
      const signal = init?.signal
        ? AbortSignal.any([init.signal, timeoutSignal])
        : timeoutSignal;
      return fetch(url, { ...init, signal });
    },
    timeoutMs,
    `fetch timeout after ${timeoutMs}ms: ${url}`,
  );
}
