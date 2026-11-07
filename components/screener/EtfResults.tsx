"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import CompanyInfoButton from "@/components/CompanyInfoButton";
import { DEFAULT_ETF_CATEGORY_ORDER, ETF_CATEGORY_LABELS } from "@/lib/etf-catalog";
import {
  formatPercentDecimal,
  formatPrice,
} from "@/lib/screener-format";
import type { EtfCategory, ScreenerEtfRow } from "@/lib/screener-types";

type EtfState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; etfs: ScreenerEtfRow[] };

let etfRequest: Promise<ScreenerEtfRow[]> | null = null;

function loadEtfs(): Promise<ScreenerEtfRow[]> {
  etfRequest ??= fetch("/api/screener/etfs")
    .then(async (res) => {
      const json: unknown = await res.json().catch(() => null);
      const etfs = json && typeof json === "object" ? (json as { etfs?: unknown }).etfs : null;
      if (!res.ok || !Array.isArray(etfs)) throw new Error("ETF request failed");
      return etfs as ScreenerEtfRow[];
    })
    .catch((e) => {
      etfRequest = null; // allow retry
      throw e;
    });
  return etfRequest;
}

export function useEtfs(): { state: EtfState; retry: () => void } {
  const [state, setState] = useState<EtfState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadEtfs().then(
      (etfs) => !cancelled && setState({ status: "ready", etfs }),
      () => !cancelled && setState({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  return {
    state,
    retry: () => {
      setState({ status: "loading" });
      setAttempt((a) => a + 1);
    },
  };
}

/** Requested categories first (in the parser's order), then the rest. */
export function orderEtfCategories(preferred: EtfCategory[] | undefined): EtfCategory[] {
  const first = preferred ?? [];
  return [...first, ...DEFAULT_ETF_CATEGORY_ORDER.filter((c) => !first.includes(c))];
}

type Props = {
  state: EtfState;
  onRetry: () => void;
  preferredCategories?: EtfCategory[];
  intro?: ReactNode;
};

export function EtfResults({ state, onRetry, preferredCategories, intro }: Props) {
  const [showAll, setShowAll] = useState(false);
  const order = useMemo(() => orderEtfCategories(preferredCategories), [preferredCategories]);
  const narrowed = (preferredCategories?.length ?? 0) > 0 && !showAll;
  const categories = narrowed ? order.slice(0, preferredCategories!.length) : order;

  if (state.status === "loading") return <EtfSkeleton />;
  if (state.status === "error") {
    return (
      <div className="rounded-3xl border border-intrinsic-secondary/15 bg-intrinsic-light px-6 py-10 text-center">
        <p className="text-sm text-intrinsic-ink">Couldn&apos;t load live ETF data right now.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full border border-intrinsic-secondary/30 px-4 py-1.5 text-xs font-medium text-intrinsic-ink hover:bg-intrinsic-bg"
        >
          Try again
        </button>
      </div>
    );
  }

  const groups = categories
    .map((c) => ({ category: c, etfs: state.etfs.filter((e) => e.category === c) }))
    .filter((g) => g.etfs.length > 0);

  return (
    <div className="space-y-6">
      {intro}
      {groups.map((g) => (
        <section key={g.category} aria-labelledby={`etf-${g.category}`}>
          <h3
            id={`etf-${g.category}`}
            className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-intrinsic-secondary"
          >
            {ETF_CATEGORY_LABELS[g.category]}
          </h3>
          <ul className="divide-y divide-intrinsic-secondary/10 overflow-hidden rounded-3xl border border-intrinsic-secondary/12 bg-intrinsic-light shadow-[0_1px_2px_rgba(42,38,34,0.04)]">
            {g.etfs.map((etf) => (
              <EtfCard key={etf.symbol} etf={etf} />
            ))}
          </ul>
        </section>
      ))}
      {narrowed ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light px-5 py-2 text-sm font-medium text-intrinsic-ink transition-colors hover:bg-intrinsic-bg"
          >
            Show all ETF types
          </button>
        </div>
      ) : null}
      <p className="px-1 text-xs leading-relaxed text-intrinsic-secondary">
        A starting list of well-known, low-cost funds, not a recommendation. Prices, fees,
        yields and returns are live from Yahoo Finance.
      </p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const toneClass =
    tone === "pos" ? "text-emerald-800" : tone === "neg" ? "text-rose-800/90" : "text-intrinsic-ink";
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-intrinsic-secondary">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-medium tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function EtfCard({ etf }: { etf: ScreenerEtfRow }) {
  const href = `/stock/${encodeURIComponent(etf.symbol)}`;
  const ytdTone =
    etf.ytdReturn === null || etf.ytdReturn === 0 ? undefined : etf.ytdReturn > 0 ? "pos" : "neg";
  return (
    <li className="group relative flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-intrinsic-bg/45 has-[a:focus-visible]:bg-intrinsic-bg/45 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-intrinsic-accent text-[11px] font-semibold tracking-tight text-emerald-950/70"
          aria-hidden
        >
          {etf.symbol.replace(/\.TO$/, "").slice(0, 4)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={href}
              className="text-[15px] font-semibold text-intrinsic-ink outline-none after:absolute after:inset-0 focus-visible:underline"
            >
              {etf.symbol}
            </Link>
            <span className="rounded-md bg-intrinsic-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-intrinsic-secondary">
              ETF · {etf.currency ?? "USD"}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[13px] text-intrinsic-secondary">{etf.name}</div>
        </div>
        <div className="relative z-10 sm:hidden">
          <CompanyInfoButton symbol={etf.symbol} name={etf.name} variant="icon" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 sm:w-[400px] sm:shrink-0 sm:grid-cols-[1.1fr_1fr_0.8fr_0.9fr]">
        <Metric label="Price" value={formatPrice(etf.price, etf.currency)} />
        <Metric label="Fee / yr" value={formatPercentDecimal(etf.expenseRatio)} />
        <Metric label="Yield" value={formatPercentDecimal(etf.dividendYield)} />
        <Metric label="YTD" value={formatPercentDecimal(etf.ytdReturn, { signed: true, digits: 1 })} tone={ytdTone} />
      </div>
      <div className="hidden shrink-0 items-center justify-end gap-2 sm:flex">
        <div className="relative z-10">
          <CompanyInfoButton symbol={etf.symbol} name={etf.name} variant="icon" />
        </div>
        <ChevronRight className="h-4 w-4 text-intrinsic-secondary/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </li>
  );
}

function EtfSkeleton() {
  return (
    <ul className="divide-y divide-intrinsic-secondary/10 overflow-hidden rounded-3xl border border-intrinsic-secondary/12 bg-intrinsic-light" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex animate-pulse items-center gap-3 px-5 py-4">
          <div className="h-10 w-10 rounded-xl bg-intrinsic-accent/60" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-16 rounded-full bg-intrinsic-bg" />
            <div className="h-3 w-48 rounded-full bg-intrinsic-bg/70" />
          </div>
          <div className="hidden h-8 w-[400px] rounded-lg bg-intrinsic-bg/60 sm:block" />
        </li>
      ))}
    </ul>
  );
}
