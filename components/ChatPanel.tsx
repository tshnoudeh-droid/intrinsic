"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatStockContext } from "@/lib/chat-context";

type Props = {
  stockContext: ChatStockContext;
  onClose: () => void;
};

export function ChatPanel({ stockContext, onClose }: Props) {
  // Recreated whenever stockContext changes (e.g. assumption sliders moved)
  // so each request carries the latest snapshot of what's on screen.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { stockContext },
      }),
    [stockContext],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isBusy]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-3xl border border-[#A69486]/40 bg-intrinsic-light shadow-2xl shadow-black/10 sm:inset-x-auto sm:right-6 sm:w-[380px]">
      <div className="flex items-center justify-between border-b border-intrinsic-secondary/15 px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-intrinsic-ink">
          <Sparkles className="h-4 w-4 text-[#A69486]" aria-hidden />
          Intrinsic AI
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-full p-1.5 text-intrinsic-secondary transition-colors duration-200 ease-out hover:bg-intrinsic-bg hover:text-intrinsic-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-intrinsic-secondary">
            How can I help? Ask me anything about {stockContext.symbol}&mdash;
            its valuation, the assumptions behind it, or recent news.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => {
              const text = message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("");
              if (!text) return null;
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? "ml-auto bg-intrinsic-ink text-intrinsic-light"
                      : "mr-auto bg-intrinsic-bg text-intrinsic-ink"
                  }`}
                >
                  {text}
                </div>
              );
            })}
            {status === "submitted" ? (
              <div className="mr-auto rounded-2xl bg-intrinsic-bg px-3.5 py-2.5 text-sm text-intrinsic-secondary">
                Thinking…
              </div>
            ) : null}
          </div>
        )}
        {error ? (
          <p className="mt-3 text-xs leading-relaxed text-rose-900/80">
            Something went wrong reaching Intrinsic AI. Try again in a bit.
          </p>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-intrinsic-secondary/15 px-4 py-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${stockContext.symbol}...`}
          disabled={isBusy}
          className="flex-1 rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light px-4 py-2 text-sm text-intrinsic-ink placeholder:text-intrinsic-secondary/70 focus:border-[#A69486] focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="rounded-full bg-intrinsic-ink px-4 py-2 text-sm font-medium text-intrinsic-light transition-opacity duration-200 ease-out disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
