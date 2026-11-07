import { ChevronRight } from "lucide-react";
import Link from "next/link";
import CompanyInfoButton from "@/components/CompanyInfoButton";
import {
  currencyForExchange,
  formatGrowth,
  formatMarginOfSafety,
  formatMarketCap,
  formatPe,
  formatPrice,
} from "@/lib/screener-format";
import type { ScreenerStockRow } from "@/lib/screener-types";

type Props = {
  row: ScreenerStockRow;
  sector?: string | null;
};

export function valuationBadgeClass(label: ScreenerStockRow["valuation_label"]): string {
  switch (label) {
    case "Undervalued":
      return "bg-intrinsic-accent text-emerald-950/80 ring-emerald-900/10";
    case "Overvalued":
      return "bg-rose-50 text-rose-900/80 ring-rose-900/10";
    case "Fair":
      return "bg-intrinsic-bg text-intrinsic-ink/80 ring-intrinsic-secondary/20";
    default:
      return "bg-intrinsic-bg/60 text-intrinsic-secondary ring-intrinsic-secondary/15";
  }
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const toneClass =
    tone === "pos" ? "text-emerald-800" : tone === "neg" ? "text-rose-800/90" : "text-intrinsic-ink";
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-intrinsic-secondary">
        {label}
      </div>
      <div className={`mt-0.5 truncate text-sm font-medium tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function tone(v: number | null): "pos" | "neg" | undefined {
  if (v === null || !Number.isFinite(v) || v === 0) return undefined;
  return v > 0 ? "pos" : "neg";
}

/**
 * One stock result. The whole card is a link to /stock/[symbol] via a
 * stretched pseudo-element on the title link; the info button sits above it.
 */
export function StockResultCard({ row, sector }: Props) {
  const currency = currencyForExchange(row.exchange);
  const href = `/stock/${encodeURIComponent(row.symbol)}`;

  return (
    <li className="group relative flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-intrinsic-bg/45 has-[a:focus-visible]:bg-intrinsic-bg/45 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-intrinsic-bg text-[11px] font-semibold tracking-tight text-intrinsic-ink/80"
          aria-hidden
        >
          {row.symbol.replace(/\.TO$/, "").slice(0, 4)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={href}
              className="text-[15px] font-semibold text-intrinsic-ink outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:underline"
            >
              {row.symbol}
            </Link>
            {row.exchange === "TSX" ? (
              <span className="rounded-md bg-intrinsic-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-intrinsic-secondary">
                TSX
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 sm:hidden ${valuationBadgeClass(row.valuation_label)}`}
            >
              {row.valuation_label ?? "No estimate"}
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-intrinsic-secondary">
            <span className="truncate">{row.name}</span>
            {sector ? (
              <>
                <span aria-hidden className="text-intrinsic-secondary/50">·</span>
                <span className="shrink-0 text-intrinsic-ink/60">{sector}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="relative z-10 sm:hidden">
          <CompanyInfoButton symbol={row.symbol} name={row.name} variant="icon" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 sm:w-[400px] sm:shrink-0 sm:grid-cols-[1.1fr_1fr_0.8fr_0.9fr]">
        <Metric label="Price" value={formatPrice(row.price, currency)} />
        <Metric
          label="Safety"
          value={formatMarginOfSafety(row.margin_of_safety)}
          tone={tone(row.margin_of_safety)}
        />
        <Metric label="P/E" value={formatPe(row.pe_ratio)} />
        <Metric label="Growth" value={formatGrowth(row.revenue_growth)} tone={tone(row.revenue_growth)} />
      </div>

      <div className="hidden w-[180px] shrink-0 items-center justify-end gap-2 sm:flex">
        <span className="text-xs tabular-nums text-intrinsic-secondary" title="Market cap">
          {formatMarketCap(row.market_cap, currency)}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${valuationBadgeClass(row.valuation_label)}`}
        >
          {row.valuation_label ?? "No estimate"}
        </span>
        <div className="relative z-10">
          <CompanyInfoButton symbol={row.symbol} name={row.name} variant="icon" />
        </div>
        <ChevronRight
          className="h-4 w-4 text-intrinsic-secondary/60 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </li>
  );
}

export function StockResultSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="divide-y divide-intrinsic-secondary/10 overflow-hidden rounded-3xl border border-intrinsic-secondary/12 bg-intrinsic-light" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex animate-pulse flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-intrinsic-bg" />
            <div className="space-y-2">
              <div className="h-3.5 w-16 rounded-full bg-intrinsic-bg" />
              <div className="h-3 w-40 rounded-full bg-intrinsic-bg/70" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:w-[400px]">
            {Array.from({ length: 4 }, (_, j) => (
              <div key={j} className="h-8 rounded-lg bg-intrinsic-bg/60" />
            ))}
          </div>
          <div className="hidden h-6 w-[180px] rounded-full bg-intrinsic-bg/60 sm:block" />
        </li>
      ))}
    </ul>
  );
}
