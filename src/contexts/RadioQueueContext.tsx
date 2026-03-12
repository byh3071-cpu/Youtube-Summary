"use client";

/** 라디오 플레이어 전역 상태: 큐(목록), 현재 인덱스, 재생 여부 및 재생/일시정지/다음/이전/닫기 액션 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { qaLog } from "@/lib/qa-log";

export interface RadioQueueItem {
  videoId: string;
  title: string;
  /** AI 3줄 요약 (가사 뷰용). 없으면 요약 불러오기로 채움 */
  summary?: string;
}

interface RadioQueueState {
  queue: RadioQueueItem[];
  currentIndex: number;
  isPlaying: boolean;
}

export interface RadioPlaybackState {
  videoId: string;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
}

interface RadioQueueContextValue extends RadioQueueState {
  addToQueue: (item: RadioQueueItem) => void;
  replaceQueue: (items: RadioQueueItem[]) => void;
  removeFromQueue: (index: number) => void;
  setCurrentIndex: (index: number) => void;
  updateItemSummary: (videoId: string, summary: string) => void;
  updatePlayback: (state: RadioPlaybackState) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  close: () => void;
  currentItem: RadioQueueItem | null;
  playback: RadioPlaybackState | null;
}

const RadioQueueContext = createContext<RadioQueueContextValue | null>(null);

export function RadioQueueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RadioQueueState>({
    queue: [],
    currentIndex: 0,
    isPlaying: false,
  });
  const [playback, setPlayback] = useState<RadioPlaybackState | null>(null);

  const currentItem =
    state.queue.length > 0 && state.currentIndex >= 0 && state.currentIndex < state.queue.length
      ? state.queue[state.currentIndex]
      : null;

  const addToQueue = useCallback((item: RadioQueueItem) => {
    qaLog.radio.queueAdded(item.videoId, item.title, !!item.summary);
    setState((prev) => {
      const exists = prev.queue.some((q) => q.videoId === item.videoId);
      if (exists) return prev;
      const queue = [...prev.queue, item];
      const currentIndex = prev.queue.length === 0 ? 0 : prev.currentIndex;
      return { ...prev, queue, currentIndex, isPlaying: prev.queue.length === 0 ? true : prev.isPlaying };
    });
  }, []);

  const replaceQueue = useCallback((items: RadioQueueItem[]) => {
    if (!items || items.length === 0) {
      setState({ queue: [], currentIndex: 0, isPlaying: false });
      return;
    }
    items.forEach((item) => qaLog.radio.queueAdded(item.videoId, item.title, !!item.summary));
    setState({
      queue: items,
      currentIndex: 0,
      isPlaying: true,
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setState((prev) => {
      const queue = prev.queue.filter((_, i) => i !== index);
      let currentIndex = prev.currentIndex;
      if (currentIndex >= queue.length) currentIndex = Math.max(0, queue.length - 1);
      if (index < prev.currentIndex) currentIndex -= 1;
      return { ...prev, queue, currentIndex, isPlaying: queue.length > 0 ? prev.isPlaying : false };
    });
  }, []);

  const setCurrentIndex = useCallback((index: number) => {
    setState((prev) => {
      const newIndex = Math.max(0, Math.min(index, prev.queue.length - 1));
      const item = prev.queue[newIndex];
      queueMicrotask(() => qaLog.radio.currentIndexChanged(newIndex, item?.title ?? ""));
      return { ...prev, currentIndex: newIndex };
    });
  }, []);

  const updateItemSummary = useCallback((videoId: string, summary: string) => {
    qaLog.radio.summaryUpdated(videoId);
    setState((prev) => ({
      ...prev,
      queue: prev.queue.map((item) =>
        item.videoId === videoId ? { ...item, summary } : item
      ),
    }));
  }, []);

  const updatePlayback = useCallback((next: RadioPlaybackState) => {
    setPlayback((prev) => {
      // 같은 위치로의 미세 업데이트는 건너뛰어 렌더링 빈도 조절
      if (prev && prev.videoId === next.videoId) {
        const delta = Math.abs(prev.positionSeconds - next.positionSeconds);
        if (delta < 1 && prev.completed === next.completed) {
          return prev;
        }
      }
      return next;
    });
  }, []);

  const play = useCallback(() => setState((prev) => ({ ...prev, isPlaying: true })), []);
  const pause = useCallback(() => setState((prev) => ({ ...prev, isPlaying: false })), []);
  const togglePlay = useCallback(
    () => setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying })),
    []
  );

  const next = useCallback(() => {
    setState((prev) => {
      if (prev.queue.length === 0) return prev;
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.queue.length) {
        return { ...prev, isPlaying: false };
      }
      return { ...prev, currentIndex: nextIndex };
    });
  }, []);

  const prev = useCallback(() => {
    setState((prev) => {
      if (prev.queue.length === 0) return prev;
      const prevIndex = prev.currentIndex - 1;
      if (prevIndex < 0) return prev;
      return { ...prev, currentIndex: prevIndex };
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => {
      qaLog.radio.playerClosed(prev.queue.length);
      return { queue: [], currentIndex: 0, isPlaying: false };
    });
  }, []);

  const value: RadioQueueContextValue = useMemo(
    () => ({
      ...state,
      addToQueue,
      replaceQueue,
      removeFromQueue,
      setCurrentIndex,
      updateItemSummary,
      updatePlayback,
      play,
      pause,
      togglePlay,
      next,
      prev,
      close,
      currentItem,
      playback,
    }),
    [state, currentItem, playback, addToQueue, replaceQueue, removeFromQueue, setCurrentIndex, updateItemSummary, updatePlayback, play, pause, togglePlay, next, prev, close]
  );

  return (
    <RadioQueueContext.Provider value={value}>
      {children}
    </RadioQueueContext.Provider>
  );
}

export function useRadioQueue() {
  const ctx = useContext(RadioQueueContext);
  if (!ctx) throw new Error("useRadioQueue must be used within RadioQueueProvider");
  return ctx;
}

export function useRadioQueueOptional() {
  return useContext(RadioQueueContext);
}
