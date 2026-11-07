import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import {
  OpenWatchlistButton,
  OpenWatchlistOnMount,
} from "@/components/nav/OpenWatchlistOnMount";

export const metadata: Metadata = {
  title: "Watchlist | Intrinsic",
};

export default async function WatchlistPage() {
  const { userId } = await auth();
  if (userId === null) {
    // proxy.ts normally handles this; keep a server-side fallback.
    redirect("/sign-in?redirect_url=%2Fwatchlist");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-20 text-center">
      <OpenWatchlistOnMount />
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-intrinsic-accent text-emerald-900">
        <Bookmark className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-intrinsic-ink">
        Your watchlist
      </h1>
      <p className="mt-2 text-pretty text-[15px] leading-relaxed text-intrinsic-ink-soft">
        Your saved stocks open in a panel from the Watchlist button in the top
        bar, so they&apos;re one tap away on every page. Star a stock in the
        Valuator to add it.
      </p>
      <div className="mt-8 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
        <OpenWatchlistButton className="rounded-full bg-intrinsic-ink px-6 py-2.5 text-sm font-medium text-intrinsic-light transition-opacity hover:opacity-90" />
        <Link
          href="/explore"
          className="rounded-full border border-intrinsic-secondary/30 px-6 py-2.5 text-sm font-medium text-intrinsic-ink transition-colors hover:bg-intrinsic-secondary/10"
        >
          Find a stock
        </Link>
      </div>
    </div>
  );
}
