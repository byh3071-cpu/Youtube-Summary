"use client";

import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { ThemeIcon } from "@/components/ui/ThemeIcon";

interface Props {
  videoId: string;
  title: string;
}

export default function AddToRadioButton({ videoId, title }: Props) {
  const radio = useRadioQueueOptional();
  if (!radio) return null;

  const inQueue = radio.queue.some((q) => q.videoId === videoId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const summary =
      typeof window !== "undefined"
        ? localStorage.getItem(`summary_${videoId}`) ?? undefined
        : undefined;
    radio.addToQueue({ videoId, title, ...(summary ? { summary } : {}) });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={inQueue ? "이미 라디오 큐에 있음" : "라디오에 추가"}
      className="inline-flex items-center gap-1.5 rounded-full border border-(--notion-border) bg-(--notion-gray)/50 px-2.5 py-1 text-[11px] font-medium text-(--notion-fg)/80 transition-colors hover:bg-(--notion-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--notion-fg)/20"
    >
      <ThemeIcon name="Play_the_radio" alt="라디오" size={14} />
      {inQueue ? "큐에 있음" : "라디오에 추가"}
    </button>
  );
}
