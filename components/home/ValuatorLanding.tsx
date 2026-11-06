"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowRight, Gauge, ListFilter } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";

const SUGGESTED = ["AAPL", "NVDA", "TSLA", "SHOP", "BRK-B", "TSM"] as const;

function isNYSERegularSessionOpen(at: Date): boolean {
  const weekday = at.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  });
  if (weekday === "Sat" || weekday === "Sun") return false;

  const timeEt = at.toLocaleTimeString("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hStr, mStr] = timeEt.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  const minutes = h * 60 + m;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

/** Landing view for the Intrinsic Valuator (/explore). */
export function ValuatorLanding() {
  const { user, isSignedIn } = useUser();
  const firstName = user?.firstName?.trim();
  const [marketsOpen, setMarketsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const tick = () => setMarketsOpen(isNYSERegularSessionOpen(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const greeting = useMemo(() => {
    if (!isSignedIn) return null;
    return firstName ? `Welcome back, ${firstName}.` : "Welcome back.";
  }, [isSignedIn, firstName]);

  return (
    <div className="relative flex w-full flex-1 flex-col items-center py-16 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[min(720px,100%)] -translate-x-1/2 rounded-full bg-intrinsic-accent/60 blur-3xl"
      />

      <div className="mx-auto w-full max-w-[600px] text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-intrinsic-secondary/20 bg-intrinsic-light/70 px-3 py-1 text-xs font-medium text-intrinsic-ink-soft">
          <Gauge className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Intrinsic Valuator
        </p>

        {greeting ? (
          <p className="mt-6 text-sm font-medium text-intrinsic-ink-soft">
            {greeting}
          </p>
        ) : null}
        <h1
          className={`${greeting ? "mt-2" : "mt-6"} text-balance text-4xl font-semibold tracking-tight text-intrinsic-ink sm:text-5xl`}
        >
          What&apos;s a stock actually worth?
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-intrinsic-ink-soft sm:text-base">
          Search any NYSE, NASDAQ, or TSX company to see its intrinsic value
          next to today&apos;s price.
        </p>

        <div className="mt-8 w-full text-left">
          <SearchBar
            autoFocus
            className="max-w-none"
            placeholder="Ticker or company, e.g. AAPL or Shopify"
          />
        </div>

        <div className="mt-3 flex h-4 items-center justify-center gap-2 text-xs text-intrinsic-secondary">
          {marketsOpen === null ? null : (
            <>
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  marketsOpen ? "bg-emerald-500" : "bg-intrinsic-secondary/60"
                }`}
                aria-hidden
              />
              <span>
                {marketsOpen ? "US markets open" : "US markets closed"}
              </span>
            </>
          )}
        </div>

        <p className="mt-10 text-[11px] font-medium uppercase tracking-wider text-intrinsic-secondary">
          Popular stocks
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {SUGGESTED.map((sym) => (
            <Link
              key={sym}
              href={`/stock/${encodeURIComponent(sym)}`}
              className="rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light/70 px-3.5 py-1.5 text-xs font-medium text-intrinsic-ink transition-colors hover:border-intrinsic-secondary/50 hover:bg-intrinsic-light"
            >
              {sym}
            </Link>
          ))}
        </div>

        <Link
          href="/screener"
          className="group mt-14 flex items-center gap-4 rounded-2xl border border-intrinsic-secondary/15 bg-intrinsic-light/80 p-4 text-left transition-shadow hover:shadow-md hover:shadow-black/5 sm:p-5"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-intrinsic-ink text-intrinsic-light">
            <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-intrinsic-ink">
              Don&apos;t have a ticker in mind?
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug text-intrinsic-ink-soft">
              Describe what you want in the Intrinsic Screener and get a list.
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-intrinsic-ink-soft transition-transform duration-200 group-hover:translate-x-0.5"
            strokeWidth={1.75}
            aria-hidden
          />
        </Link>
      </div>
    </div>
  );
}
