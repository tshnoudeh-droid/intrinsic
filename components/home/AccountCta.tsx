"use client";

import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { OPEN_WATCHLIST_EVENT } from "@/components/nav/products";

/** Closing homepage band: sign-up for guests, watchlist shortcut for members. */
export function AccountCta() {
  return (
    <section className="rounded-3xl border border-intrinsic-secondary/15 bg-intrinsic-light px-6 py-10 text-center sm:px-10 sm:py-12">
      <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-intrinsic-accent text-emerald-900">
        <Bookmark className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <Show when="signed-out">
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-intrinsic-ink">
          Keep a watchlist
        </h2>
        <p className="mx-auto mt-2 max-w-md text-pretty text-[15px] leading-relaxed text-intrinsic-ink-soft">
          A free account lets you star stocks and check how their valuations
          change. Everything else works without one.
        </p>
        <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5 sm:flex-row">
          <Link
            href="/sign-up"
            className="flex-1 rounded-full bg-intrinsic-ink px-5 py-2.5 text-sm font-medium text-intrinsic-light transition-opacity hover:opacity-90"
          >
            Create free account
          </Link>
          <Link
            href="/sign-in"
            className="flex-1 rounded-full border border-intrinsic-secondary/30 px-5 py-2.5 text-sm font-medium text-intrinsic-ink transition-colors hover:bg-intrinsic-secondary/10"
          >
            Sign in
          </Link>
        </div>
      </Show>
      <Show when="signed-in">
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-intrinsic-ink">
          Your watchlist
        </h2>
        <p className="mx-auto mt-2 max-w-md text-pretty text-[15px] leading-relaxed text-intrinsic-ink-soft">
          Star any stock in the Valuator to save it. Your list is always one
          tap away in the top bar.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_WATCHLIST_EVENT))}
          className="mt-6 rounded-full bg-intrinsic-ink px-6 py-2.5 text-sm font-medium text-intrinsic-light transition-opacity hover:opacity-90"
        >
          Open watchlist
        </button>
      </Show>
    </section>
  );
}
