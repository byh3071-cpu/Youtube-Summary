import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/** 클라이언트 하이드레이션이 끝났는지 여부를 반환하는 훅 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

