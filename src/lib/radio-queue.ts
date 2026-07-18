export interface ReorderedQueue<T> {
  queue: T[];
  currentIndex: number;
}

/**
 * 큐 항목을 이동하면서 현재 재생 중인 항목의 정체성을 보존한다.
 * 현재 항목 자체가 이동하거나 다른 항목이 현재 위치를 가로질러도 같은 항목이 유지된다.
 */
export function reorderQueue<T>(
  queue: T[],
  currentIndex: number,
  fromIndex: number,
  toIndex: number
): ReorderedQueue<T> {
  const lastIndex = queue.length - 1;
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex > lastIndex ||
    toIndex > lastIndex
  ) {
    return { queue, currentIndex };
  }

  const nextQueue = [...queue];
  const [movedItem] = nextQueue.splice(fromIndex, 1);
  nextQueue.splice(toIndex, 0, movedItem);

  let nextCurrentIndex = currentIndex;
  if (currentIndex === fromIndex) {
    nextCurrentIndex = toIndex;
  } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
    nextCurrentIndex -= 1;
  } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
    nextCurrentIndex += 1;
  }

  return { queue: nextQueue, currentIndex: nextCurrentIndex };
}
