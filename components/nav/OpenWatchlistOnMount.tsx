"use client";

import { useEffect } from "react";
import { OPEN_WATCHLIST_EVENT } from "@/components/nav/products";

/** Opens the navbar watchlist drawer once, e.g. when landing on /watchlist. */
export function OpenWatchlistOnMount() {
  useEffect(() => {
    window.dispatchEvent(new Event(OPEN_WATCHLIST_EVENT));
  }, []);
  return null;
}

export function OpenWatchlistButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_WATCHLIST_EVENT))}
      className={className}
    >
      Open watchlist
    </button>
  );
}
