"use client";

import { useEffect, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatPanel } from "@/components/ChatPanel";
import type { ChatStockContext } from "@/lib/chat-context";

/** Window event other components dispatch to open the chat with a question. */
export const ASK_INTRINSIC_AI_EVENT = "intrinsic:ask-ai";

export function askIntrinsicAi(question: string) {
  window.dispatchEvent(
    new CustomEvent<{ question: string }>(ASK_INTRINSIC_AI_EVENT, {
      detail: { question },
    }),
  );
}

type Props = {
  stockContext: ChatStockContext;
};

export function IntrinsicChat({ stockContext }: Props) {
  const [open, setOpen] = useState(false);
  // Bumped per request so the same question can be asked twice.
  const [pending, setPending] = useState<{ id: number; question: string } | null>(
    null,
  );

  useEffect(() => {
    function onAsk(e: Event) {
      const question = (e as CustomEvent<{ question?: unknown }>).detail?.question;
      if (typeof question !== "string" || !question.trim()) return;
      setPending((prev) => ({ id: (prev?.id ?? 0) + 1, question }));
      setOpen(true);
    }
    window.addEventListener(ASK_INTRINSIC_AI_EVENT, onAsk);
    return () => window.removeEventListener(ASK_INTRINSIC_AI_EVENT, onAsk);
  }, []);

  if (!open) {
    return <ChatBubble onExpand={() => setOpen(true)} />;
  }

  return (
    <ChatPanel
      stockContext={stockContext}
      pendingQuestion={pending}
      onClose={() => {
        setOpen(false);
        setPending(null);
      }}
    />
  );
}
