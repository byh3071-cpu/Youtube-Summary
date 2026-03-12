/** 브라우저(클라이언트) 환경 여부를 반환합니다. SSR 시에는 false를 반환합니다. */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}
