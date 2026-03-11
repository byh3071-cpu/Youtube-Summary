import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { qaLog } from "@/lib/qa-log";
import { X, Trash2 } from "lucide-react";

interface RadioPlaylistDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}

export function RadioPlaylistDrawer({ drawerOpen, setDrawerOpen }: RadioPlaylistDrawerProps) {
  const radio = useRadioQueueOptional();

  if (!drawerOpen || !radio) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-55 bg-(--notion-fg)/20"
        aria-hidden
        onClick={() => setDrawerOpen(false)}
      />
      <div
        className="fixed bottom-16 left-4 right-4 z-56 max-h-[60vh] overflow-auto rounded-t-2xl border border-b-0 border-(--notion-border) bg-(--notion-bg) shadow-2xl transition-transform md:left-auto md:right-6 md:max-w-sm"
        role="dialog"
        aria-label="재생 대기열"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-(--notion-border) bg-(--notion-gray) px-4 py-3">
          <h3 className="text-sm font-semibold text-(--notion-fg)">재생 대기열</h3>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-full p-1 text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <ul className="divide-y divide-(--notion-border)">
          {radio.queue.map((item, index) => (
            <li
              key={`${item.videoId}-${index}`}
              className={`flex items-center gap-2 px-4 py-2.5 transition-colors ${index === radio.currentIndex ? "bg-(--focus-accent-muted) border-l-2 border-(--focus-accent)" : "hover:bg-(--notion-gray)/50"}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm text-(--notion-fg)"
                onClick={() => {
                  radio.setCurrentIndex(index);
                  setDrawerOpen(false);
                }}
              >
                {item.title}
              </button>
              <button
                type="button"
                onClick={() => {
                  qaLog.radio.queueRemoved(index, item.videoId);
                  radio.removeFromQueue(index);
                }}
                className="shrink-0 rounded-full p-1 text-(--notion-fg)/50 hover:bg-(--notion-hover) hover:text-red-600"
                aria-label="목록에서 제거"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
