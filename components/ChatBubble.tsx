"use client";

import { Sparkles } from "lucide-react";

type Props = {
  onExpand: () => void;
};

export function ChatBubble({ onExpand }: Props) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="fixed bottom-6 right-4 z-40 flex items-center gap-2 rounded-full border border-[#A69486] bg-intrinsic-light px-4 py-3 text-sm font-medium text-intrinsic-ink shadow-lg shadow-black/5 transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl sm:right-6"
      aria-label="Open Intrinsic AI chat"
    >
      <Sparkles className="h-4 w-4 text-[#A69486]" aria-hidden />
      Intrinsic AI
    </button>
  );
}
