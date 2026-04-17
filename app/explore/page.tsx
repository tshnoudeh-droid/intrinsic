"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";

const SUGGESTED = [
  "AAPL",
  "NVDA",
  "TSLA",
  "SHOP",
  "BRK-B",
  "TSM",
] as const;

export default function ExplorePage() {
  const router = useRouter();

  return (
    <div
      className="flex min-h-[calc(100dvh-5rem)] w-full flex-col items-center justify-center px-4 py-12"
      style={{ background: "#EDE8DF" }}
    >
      <div className="mx-auto w-full max-w-[640px]">
        <p className="mb-8 text-sm" style={{ color: "#A69486" }}>
          Intrinsic
        </p>

        <h1 className="mb-2 text-center text-3xl font-semibold text-intrinsic-ink">
          What&apos;s a stock actually worth?
        </h1>
        <p className="mb-8 text-center text-sm" style={{ color: "#A69486" }}>
          Search any stock to see its intrinsic value.
        </p>

        <div className="w-full">
          <SearchBar autoFocus className="max-w-none" />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
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

        <p className="mt-12 text-center text-xs" style={{ color: "#A69486" }}>
          <Link
            href="/"
            className="transition-colors hover:text-intrinsic-ink/80"
            style={{ color: "#A69486" }}
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
