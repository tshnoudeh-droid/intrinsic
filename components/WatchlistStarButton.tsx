"use client";

import { useUser } from "@clerk/nextjs";
import { Star } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  addToWatchlist,
  isInWatchlist,
  removeFromWatchlist,
} from "@/lib/watchlist";

type Props = {
  symbol: string;
};

export function WatchlistStarButton({ symbol }: Props) {
  const { isSignedIn, user } = useUser();
  const userId = user?.id ?? null;
  const pathname = usePathname() ?? "/";

  const [saved, setSaved] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

  const syncSaved = useCallback(() => {
    if (!userId) {
      setSaved(false);
      return;
    }
    setSaved(isInWatchlist(userId, symbol));
  }, [userId, symbol]);

  useEffect(() => {
    syncSaved();
  }, [syncSaved]);

  useEffect(() => {
    const onChange = () => syncSaved();
    window.addEventListener("intrinsic-watchlist-changed", onChange);
    return () =>
      window.removeEventListener("intrinsic-watchlist-changed", onChange);
  }, [syncSaved]);

  useEffect(() => {
    if (!tipOpen) return;
    const t = window.setTimeout(() => setTipOpen(false), 5000);
    return () => window.clearTimeout(t);
  }, [tipOpen]);

  const handleClick = () => {
    if (!isSignedIn || !userId) {
      setTipOpen(true);
      return;
    }
    setPulse(true);
    window.setTimeout(() => setPulse(false), 280);
    if (saved) {
      removeFromWatchlist(userId, symbol);
      setSaved(false);
    } else {
      addToWatchlist(userId, symbol);
      setSaved(true);
    }
  };

  const filled = isSignedIn && saved;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleClick}
        aria-label={
          filled ? "Remove from watchlist" : "Add to watchlist"
        }
        className={`inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[#A69486] transition-transform duration-200 ease-out focus-visible:outline focus-visible:ring-2 focus-visible:ring-intrinsic-accent ${
          pulse ? "scale-125" : "scale-100"
        }`}
      >
        <Star
          className="h-6 w-6"
          strokeWidth={filled ? 0 : 1.75}
          fill={filled ? "#A69486" : "none"}
          stroke="currentColor"
        />
      </button>
      {tipOpen && !isSignedIn ? (
        <div
          role="status"
          className="absolute bottom-[calc(100%+8px)] left-1/2 z-[90] w-[230px] -translate-x-1/2 rounded-xl border border-intrinsic-secondary/20 bg-[#FAF8F4] px-3 py-2.5 text-left text-xs leading-snug text-intrinsic-ink shadow-lg"
        >
          Save stocks to a watchlist with a free account.{" "}
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(pathname)}`}
            className="font-semibold underline underline-offset-2"
          >
            Sign in
          </Link>
        </div>
      ) : null}
    </div>
  );
}
