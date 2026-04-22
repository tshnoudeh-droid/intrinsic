"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { SearchBar } from "@/components/SearchBar";

const SUGGESTED = [
  "AAPL",
  "NVDA",
  "TSLA",
  "SHOP",
  "BRK-B",
  "TSM",
] as const;

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
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  return minutes >= open && minutes < close;
}

export default function ExplorePage() {
  const router = useRouter();
  const { user, isSignedIn } = useUser();
  const firstName = user?.firstName?.trim();
  const [marketsOpen, setMarketsOpen] = useState(() =>
    isNYSERegularSessionOpen(new Date()),
  );

  useEffect(() => {
    const tick = () => setMarketsOpen(isNYSERegularSessionOpen(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const heading = useMemo(() => {
    if (isSignedIn) {
      return firstName
        ? `Welcome back, ${firstName}. What's worth buying today?`
        : "Welcome back. What's worth buying today?";
    }
    return "What's a stock actually worth?";
  }, [isSignedIn, firstName]);

  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-16"
      style={{ background: "#EDE8DF" }}
    >
      {/* Ambient background glows */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "600px",
          height: "600px",
          background:
            "radial-gradient(circle, rgba(222,240,232,0.5) 0%, transparent 70%)",
          filter: "blur(80px)",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          width: "500px",
          height: "500px",
          background:
            "radial-gradient(circle, rgba(166,148,134,0.15) 0%, transparent 70%)",
          filter: "blur(80px)",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />

      <div className="mx-auto w-full max-w-[580px]">
        <h2
          className="mb-6 text-center text-7xl font-bold tracking-tight"
          style={{ color: "#1a1a1a" }}
        >
          Intrinsic
        </h2>

        <h1
          className="mb-2 text-center text-2xl font-normal"
          style={{ color: "#5a4a3f" }}
        >
          {heading}
        </h1>
        <p className="mt-1 text-center text-sm" style={{ color: "#A69486" }}>
          Search any stock to see its intrinsic value.
        </p>

        <div className="mt-6 w-full">
          <SearchBar autoFocus className="max-w-none" />
        </div>

        <div
          className="mt-3 flex items-center justify-center gap-2 text-xs"
          style={{ color: "#A69486" }}
        >
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{
              background: marketsOpen ? "#22c55e" : "#9ca3af",
            }}
            aria-hidden
          />
          <span>{marketsOpen ? "Markets open" : "Markets closed"}</span>
        </div>

        <p
          className="mb-2 mt-5 text-center text-xs font-normal uppercase tracking-wide"
          style={{ color: "#A69486" }}
        >
          Popular stocks
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTED.map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => router.push(`/stock/${encodeURIComponent(sym)}`)}
              className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-[#e0d9cf]"
              style={{ borderColor: "#A69486", color: "#A69486" }}
            >
              {sym}
            </button>
          ))}
        </div>

        <Link
          href={isSignedIn ? "/?home=1" : "/"}
          className="mt-12 block text-center text-xs transition-colors hover:text-intrinsic-ink/80"
          style={{ color: "#A69486" }}
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
