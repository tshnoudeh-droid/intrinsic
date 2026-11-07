"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  isSignedIn: boolean;
  onOpen: () => void;
};

/**
 * Watchlist entry in the navbar. Signed-in users open the drawer; signed-out
 * users get a small explainer with sign-in links instead of a dead end.
 */
export function WatchlistNavButton({ isSignedIn, onOpen }: Props) {
  const pathname = usePathname() ?? "/";
  const [promptOpen, setPromptOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!promptOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setPromptOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPromptOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [promptOpen]);

  const redirect = encodeURIComponent(pathname);

  return (
    <div ref={wrapperRef} className="sm:relative">
      <button
        type="button"
        onClick={() => (isSignedIn ? onOpen() : setPromptOpen((o) => !o))}
        aria-label="Watchlist"
        aria-expanded={isSignedIn ? undefined : promptOpen}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-intrinsic-ink-soft transition-colors hover:bg-intrinsic-secondary/10 hover:text-intrinsic-ink"
      >
        <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        <span className="hidden md:inline">Watchlist</span>
      </button>

      {promptOpen && !isSignedIn ? (
        <div
          role="dialog"
          aria-label="Sign in to use your watchlist"
          className="absolute inset-x-4 top-[calc(100%+8px)] z-50 rounded-2xl sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[300px] border border-intrinsic-secondary/20 bg-intrinsic-light p-4 text-left shadow-xl shadow-black/10"
        >
          <p className="text-sm font-semibold text-intrinsic-ink">
            Save stocks to a watchlist
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-intrinsic-ink-soft">
            Sign in to star stocks and track their valuations. The Valuator and
            Screener stay free without an account.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href={`/sign-in?redirect_url=${redirect}`}
              onClick={() => setPromptOpen(false)}
              className="flex-1 rounded-full bg-intrinsic-ink px-3 py-2 text-center text-[13px] font-medium text-intrinsic-light transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
            <Link
              href={`/sign-up?redirect_url=${redirect}`}
              onClick={() => setPromptOpen(false)}
              className="flex-1 rounded-full border border-intrinsic-secondary/30 px-3 py-2 text-center text-[13px] font-medium text-intrinsic-ink transition-colors hover:bg-intrinsic-secondary/10"
            >
              Create account
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
