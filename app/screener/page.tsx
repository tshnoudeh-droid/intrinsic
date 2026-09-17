"use client";

import { useId, useState } from "react";
import { ScreenerResultsTable } from "@/components/ScreenerResultsTable";
import type { ScreenerFilter, ScreenerStockRow } from "@/lib/screener-types";

const EXAMPLE_QUERIES = [
  "margin of safety above 20%, revenue growth above 10%, P/E below 30",
  "undervalued and P/E below 20",
  "market cap above 100 billion",
];

type ScreenerApiResponse = {
  error?: boolean;
  message?: string;
  filters?: ScreenerFilter[];
  rows?: ScreenerStockRow[];
};

const OPERATOR_SYMBOLS: Record<ScreenerFilter["operator"], string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  eq: "=",
};

const FIELD_LABELS: Record<ScreenerFilter["field"], string> = {
  margin_of_safety: "margin of safety",
  valuation_label: "valuation",
  market_cap: "market cap",
  pe_ratio: "P/E",
  forward_pe: "forward P/E",
  revenue_growth: "revenue growth",
  price: "price",
};

function formatFilter(filter: ScreenerFilter): string {
  const field = FIELD_LABELS[filter.field] ?? filter.field;
  const operator = OPERATOR_SYMBOLS[filter.operator] ?? filter.operator;
  return `${field} ${operator} ${filter.value}`;
}

function formatFilters(filters: ScreenerFilter[]): string {
  return filters.map(formatFilter).join(", ");
}

export default function ScreenerPage() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ScreenerStockRow[] | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<ScreenerFilter[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function runQuery(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!json || typeof json !== "object") {
        setError("Something went wrong. Try again.");
        setRows(null);
        setAppliedFilters(null);
        return;
      }
      const o = json as ScreenerApiResponse;
      if (o.error) {
        setError(o.message ?? "Something went wrong.");
        setRows(null);
        setAppliedFilters(null);
        return;
      }
      const resultRows = Array.isArray(o.rows) ? o.rows : [];
      setRows(resultRows);
      setAppliedFilters(Array.isArray(o.filters) ? o.filters : null);
      setLastUpdated(resultRows[0]?.updated_at ?? null);
    } catch {
      setError("Something went wrong. Try again.");
      setRows(null);
      setAppliedFilters(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runQuery(query);
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
      <div className="w-full max-w-4xl">
        <h1 className="text-center text-3xl font-bold tracking-tight text-intrinsic-ink sm:text-4xl">
          Screener
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-intrinsic-secondary">
          Describe what you&apos;re looking for in plain English and screen
          the S&amp;P 500 and TSX 60 against it.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <label htmlFor={inputId} className="sr-only">
            Screener query
          </label>
          <input
            id={inputId}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="margin of safety above 20%, revenue growth above 10%, P/E below 30"
            disabled={loading}
            className="flex-1 rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light px-5 py-3 text-sm text-intrinsic-ink placeholder:text-intrinsic-secondary/60 focus:border-[#A69486] focus:outline-none disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-full bg-intrinsic-ink px-6 py-3 text-sm font-medium text-intrinsic-light transition-opacity duration-200 ease-out disabled:opacity-40"
          >
            {loading ? "Screening…" : "Screen"}
          </button>
        </form>

        {rows === null ? (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={loading}
                onClick={() => {
                  setQuery(example);
                  void runQuery(example);
                }}
                className="rounded-full border border-intrinsic-secondary/30 px-3 py-1.5 text-xs text-intrinsic-secondary transition-colors hover:bg-intrinsic-bg disabled:opacity-40"
              >
                {example}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mt-6 text-center text-sm text-rose-900/80">{error}</p>
        ) : null}

        {rows !== null && !error ? (
          <div className="mt-8">
            {appliedFilters && appliedFilters.length > 0 ? (
              <p className="mb-2 text-xs text-intrinsic-secondary">
                Screening for: {formatFilters(appliedFilters)}
              </p>
            ) : null}
            <div className="mb-3 flex items-center justify-between text-xs text-intrinsic-secondary">
              <span>
                {rows.length} match{rows.length === 1 ? "" : "es"}
              </span>
              {lastUpdated ? (
                <span>
                  Data as of{" "}
                  {new Date(lastUpdated).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              ) : null}
            </div>
            <ScreenerResultsTable rows={rows} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
