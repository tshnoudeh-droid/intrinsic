"use client";

import { ArrowRight, Search } from "lucide-react";
import { useId, useState } from "react";
import { EtfResults, useEtfs } from "@/components/screener/EtfResults";
import { FilterChips } from "@/components/screener/FilterChips";
import { StockResultSkeleton } from "@/components/screener/StockResultCard";
import { StockResults } from "@/components/screener/StockResults";
import {
  DEFAULT_SCREENER_INTENT,
  type ScreenerApiResponse,
  type ScreenerAssetType,
  type ScreenerFilter,
  type ScreenerIntent,
  type ScreenerStockRow,
} from "@/lib/screener-types";

const EXAMPLE_QUERIES = [
  "Something safe for the long run",
  "Undervalued and P/E below 20",
  "Cheap growing tech",
  "Index funds for beginners",
  "Canadian dividend stocks",
];

type Screen = {
  query: string;
  filters: ScreenerFilter[];
  intent: ScreenerIntent;
  rows: ScreenerStockRow[];
};

type ScreenRequest =
  | { query: string }
  | { filters: ScreenerFilter[]; intent: ScreenerIntent; query: string };

export default function ScreenerPage() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [screen, setScreen] = useState<Screen | null>(null);
  const [tab, setTab] = useState<ScreenerAssetType>("stock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const etfs = useEtfs();

  async function runScreen(req: ScreenRequest) {
    if (loading) return;
    setLoading(true);
    setError(null);
    const body = "filters" in req ? { filters: req.filters, intent: req.intent } : { query: req.query };
    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as ScreenerApiResponse | null;
      if (!json || json.error) {
        setError(json?.message ?? "Something went wrong. Try again.");
        return;
      }
      const intent = json.intent ?? DEFAULT_SCREENER_INTENT;
      setScreen({
        query: req.query,
        filters: Array.isArray(json.filters) ? json.filters : [],
        intent,
        rows: Array.isArray(json.rows) ? json.rows : [],
      });
      // A chip edit keeps whatever tab the user is on.
      if (!("filters" in req)) setTab(intent.assetTypes[0] ?? "stock");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function runQuery(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    void runScreen({ query: trimmed });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runQuery(query);
  }

  const order: ScreenerAssetType[] = screen
    ? [...screen.intent.assetTypes, ...(["stock", "etf"] as const).filter((t) => !screen.intent.assetTypes.includes(t))]
    : ["stock", "etf"];
  const etfFirst = order[0] === "etf";
  const etfCount = etfs.state.status === "ready" ? etfs.state.etfs.length : null;

  return (
    <div className="flex w-full flex-1 flex-col items-center px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
      <div className="w-full max-w-4xl">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-intrinsic-ink sm:text-[42px]">
            Find your next investment
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-intrinsic-secondary">
            Describe what you want in plain English. We&apos;ll screen the S&amp;P 500, the
            TSX 60 and popular ETFs for you.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light p-1.5 pl-5 shadow-[0_8px_30px_rgba(42,38,34,0.07)] transition-shadow focus-within:border-intrinsic-secondary/60 focus-within:shadow-[0_10px_36px_rgba(42,38,34,0.11)]"
        >
          <Search className="h-4 w-4 shrink-0 text-intrinsic-secondary" aria-hidden />
          <label htmlFor={inputId} className="sr-only">
            What are you looking for?
          </label>
          <input
            id={inputId}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. something safe for the long run, about 6% a year"
            maxLength={500}
            disabled={loading}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-intrinsic-ink placeholder:text-intrinsic-secondary/70 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-intrinsic-ink px-4 text-sm font-medium text-intrinsic-light transition-opacity disabled:opacity-40 sm:px-5"
          >
            <span className="hidden sm:inline">{loading ? "Screening…" : "Screen"}</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:hidden">Screen</span>
          </button>
        </form>

        {!screen ? (
          <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={loading}
                onClick={() => runQuery(example)}
                className="rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light/60 px-3.5 py-1.5 text-[13px] text-intrinsic-ink/80 transition-colors hover:bg-intrinsic-light hover:text-intrinsic-ink disabled:opacity-40"
              >
                {example}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="mx-auto mt-8 max-w-2xl rounded-3xl border border-intrinsic-secondary/15 bg-intrinsic-light px-6 py-6 text-center">
            <p className="text-sm text-intrinsic-ink">{error}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUERIES.slice(1, 4).map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => runQuery(example)}
                  className="rounded-full bg-intrinsic-bg px-3 py-1.5 text-xs font-medium text-intrinsic-ink hover:bg-intrinsic-bg/70"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loading && !screen ? (
          <div className="mt-12">
            <StockResultSkeleton />
          </div>
        ) : null}

        {screen ? (
          <div className={`mt-10 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm text-intrinsic-secondary">
                  Results for <span className="font-medium text-intrinsic-ink">&ldquo;{screen.query}&rdquo;</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setScreen(null);
                    setQuery("");
                    setError(null);
                  }}
                  className="shrink-0 text-xs font-medium text-intrinsic-secondary hover:text-intrinsic-ink"
                >
                  Clear
                </button>
              </div>
              <FilterChips
                filters={screen.filters}
                disabled={loading}
                onChange={(next) =>
                  void runScreen({ filters: next, intent: screen.intent, query: screen.query })
                }
              />
            </div>

            <div
              role="tablist"
              aria-label="Result type"
              className="mt-6 inline-flex rounded-full bg-intrinsic-bg/80 p-1 ring-1 ring-intrinsic-secondary/10"
            >
              {order.map((t) => {
                const count = t === "stock" ? screen.rows.length : etfCount;
                const active = tab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t)}
                    className={`flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all ${
                      active ? "bg-intrinsic-light text-intrinsic-ink shadow-sm" : "text-intrinsic-secondary hover:text-intrinsic-ink"
                    }`}
                  >
                    {t === "stock" ? "Stocks" : "ETFs"}
                    {count !== null ? (
                      <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? "bg-intrinsic-bg" : "bg-intrinsic-light/60"}`}>
                        {count}
                      </span>
                    ) : null}
                    {t === order[0] && order.length > 1 ? (
                      <span className="hidden rounded-full bg-intrinsic-accent px-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-950/70 sm:inline">
                        Best fit
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-5" role="tabpanel">
              {tab === "etf" ? (
                <EtfResults
                  state={etfs.state}
                  onRetry={etfs.retry}
                  preferredCategories={screen.intent.etfCategories}
                  intro={etfFirst ? <WhyEtfs /> : null}
                />
              ) : screen.rows.length > 0 ? (
                <StockResults key={JSON.stringify(screen.filters)} rows={screen.rows} />
              ) : (
                <div className="rounded-3xl border border-dashed border-intrinsic-secondary/30 px-6 py-12 text-center">
                  <p className="text-sm font-medium text-intrinsic-ink">
                    {screen.filters.length === 0
                      ? "This search reads like an ETF search, so there are no stock filters yet."
                      : "No stocks matched every condition."}
                  </p>
                  <p className="mt-1 text-sm text-intrinsic-secondary">
                    {screen.filters.length === 0
                      ? "Try something like “undervalued large companies” to see individual stocks."
                      : "Remove a filter above, or tap one to loosen it."}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WhyEtfs() {
  return (
    <div className="rounded-3xl bg-intrinsic-accent/70 px-5 py-4 text-[14px] leading-relaxed text-intrinsic-ink ring-1 ring-emerald-900/5">
      <p className="font-semibold">Why ETFs fit this search</p>
      <p className="mt-1 text-intrinsic-ink/80">
        For long-term, lower-risk goals, one broad ETF holds hundreds or thousands of companies
        for a small yearly fee, so no single company can sink you. Historically, broad stock
        markets have returned more than 6% a year over long periods, though never guaranteed and
        with ups and downs along the way.
      </p>
    </div>
  );
}
