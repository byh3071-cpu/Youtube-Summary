"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import AddChannelModal from "./AddChannelModal";

export default function AddChannelButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-(--notion-fg)/70 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
      >
        <Plus size={14} />
        <span>채널 추가</span>
      </button>
      <AddChannelModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
