"use client";

import { useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatPanel } from "@/components/ChatPanel";
import type { ChatStockContext } from "@/lib/chat-context";

type Props = {
  stockContext: ChatStockContext;
};

export function IntrinsicChat({ stockContext }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <ChatBubble onExpand={() => setOpen(true)} />;
  }

  return <ChatPanel stockContext={stockContext} onClose={() => setOpen(false)} />;
}
