"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatScreenerContext } from "@/lib/chat-screener-context";
import type { ScreenerAssetType } from "@/lib/screener-types";

type QuickReply = {
  label: string;
  run: () => void;
};

type Props = {
  context: ChatScreenerContext;
  /** Re-run the screener with a new plain-English query. */
  onRunQuery: (query: string) => void;
  onSelectTab: (tab: ScreenerAssetType) => void;
  disabled?: boolean;
};

function greeting(ctx: ChatScreenerContext): string {
  if (!ctx.query) {
    return "Hi! Not sure what to type? Tell me what you're investing for, or tap an option below and I'll set up the search.";
  }
  if (ctx.assetTypes[0] === "etf") {
    return "From what you described, a broad ETF is probably the best fit: lots of companies in one fund, with a small yearly fee. Want me to narrow it down?";
  }
  if (ctx.stockCount === 0) {
    return "Nothing matched every filter. Want to loosen things up, or look at ETFs instead?";
  }
  return `I found ${ctx.stockCount} stock${ctx.stockCount === 1 ? "" : "s"} that match. Want to narrow it down?`;
}

/** Inline AI guide: quick-reply chips that refine the screen, plus free chat. */
export function ScreenerGuide({ context, onRunQuery, onSelectTab, disabled }: Props) {
  // Recreated when the screen changes so each message carries what's on screen.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { mode: "screener", screenerContext: context },
      }),
    [context],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = listRef.current;
    if (el && messages.length > 0) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function ask(text: string) {
    if (busy) return;
    void sendMessage({ text });
  }

  const base = context.query;
  const refine = (extra: string) => onRunQuery(base ? `${base}, ${extra}` : extra);

  const quickReplies: QuickReply[] = base
    ? [
        {
          label: "Are you looking for ETFs?",
          run: () => {
            onSelectTab("etf");
            ask("I'm interested in ETFs. Which kind on screen fits what I searched, and why?");
          },
        },
        {
          label: "A single stock?",
          run: () => {
            onSelectTab("stock");
            ask("I'd rather pick a single stock. Which of these look strongest, and what are the risks?");
          },
        },
        { label: "A newer company?", run: () => ask("What about newer companies or IPOs?") },
        { label: "Dividend income?", run: () => refine("with dividend income") },
        { label: "Lower risk?", run: () => refine("lower risk") },
      ]
    : [
        { label: "Are you looking for ETFs?", run: () => onRunQuery("Low-cost ETFs for the long term") },
        { label: "A single stock?", run: () => onRunQuery("Undervalued large companies") },
        { label: "A newer company?", run: () => ask("Can I find newer companies or IPOs here?") },
        { label: "Dividend income?", run: () => onRunQuery("Dividend income") },
        { label: "Lower risk?", run: () => onRunQuery("Low risk, long term") },
      ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    ask(text);
    setInput("");
  }

  return (
    <section
      aria-label="Intrinsic AI guide"
      className="overflow-hidden rounded-3xl border border-intrinsic-secondary/15 bg-intrinsic-light shadow-[0_1px_2px_rgba(42,38,34,0.04)]"
    >
      <div className="flex items-center gap-2.5 border-b border-intrinsic-secondary/10 px-5 py-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-intrinsic-accent">
          <Sparkles className="h-3.5 w-3.5 text-emerald-900/70" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-intrinsic-ink">Intrinsic AI guide</p>
          <p className="text-xs text-intrinsic-secondary">Educational help, not financial advice</p>
        </div>
      </div>

      <div ref={listRef} className="max-h-[420px] space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        <Bubble role="assistant">{greeting(context)}</Bubble>
        {messages.map((m) => {
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("")
            .replace(/\*\*(.+?)\*\*/g, "$1"); // model sometimes bolds despite instructions
          if (!text) return null;
          return (
            <Bubble key={m.id} role={m.role === "user" ? "user" : "assistant"}>
              {text}
            </Bubble>
          );
        })}
        {status === "submitted" ? (
          <div className="flex gap-1 px-1 py-2" aria-label="Thinking">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-intrinsic-secondary/60"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        ) : null}
        {error ? (
          <p className="text-xs text-rose-900/80">
            Couldn&apos;t reach Intrinsic AI (you may have hit the hourly limit). Try again in a bit.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 px-5 pb-3">
        {quickReplies.map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={busy || disabled}
            onClick={q.run}
            className="rounded-full border border-intrinsic-secondary/25 bg-white/50 px-3 py-1.5 text-[13px] font-medium text-intrinsic-ink transition-colors hover:border-intrinsic-secondary/50 hover:bg-intrinsic-accent/50 disabled:opacity-40"
          >
            {q.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-intrinsic-secondary/10 px-3 py-3 sm:px-4">
        <label htmlFor="screener-guide-input" className="sr-only">
          Ask Intrinsic AI
        </label>
        <input
          id="screener-guide-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Ask anything, e.g. what's a good first ETF?"
          className="min-w-0 flex-1 rounded-full bg-intrinsic-bg/60 px-4 py-2.5 text-sm text-intrinsic-ink placeholder:text-intrinsic-secondary/70 focus:bg-intrinsic-bg focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-intrinsic-ink text-intrinsic-light transition-opacity disabled:opacity-30"
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </section>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const user = role === "user";
  return (
    <div
      className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        user ? "ml-auto rounded-br-md bg-intrinsic-ink text-intrinsic-light" : "mr-auto rounded-bl-md bg-intrinsic-bg/80 text-intrinsic-ink"
      }`}
    >
      {children}
    </div>
  );
}
