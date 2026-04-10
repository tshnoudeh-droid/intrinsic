"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StockDetailPayload } from "@/lib/stock-detail-types";
import { calculateDCF } from "@/lib/calculate-dcf-client";
import { DCF_ASSUMPTIONS } from "@/lib/calculate-intrinsic-value";
import { formatCurrencyDisplay, formatPercentOneDecimal } from "@/lib/format-display";
import { isIntrinsicEstimatePotentiallyUnreliable } from "@/lib/intrinsic-estimate-quality";
import { STOCK_PAGE_COPY } from "@/lib/stock-page-copy";
import { buildValuationExplanation } from "@/lib/valuation-explanation";
import { SearchBar } from "@/components/SearchBar";
import { WatchlistStarButton } from "@/components/WatchlistStarButton";
import { StockPriceChart } from "@/components/StockPriceChart";
import { Tooltip } from "@/components/Tooltip";
import {
  marginOfSafetyPercent,
  valuationLabelFromMargin,
} from "@/lib/valuation-label";

type Props = {
  symbol: string;
};

function isNullableNumber(v: unknown): v is number | null {
  return v === null || typeof v === "number";
}

function isStockApiError(json: unknown): json is { error: true } {
  return (
    typeof json === "object" &&
    json !== null &&
    (json as { error?: unknown }).error === true
  );
}

function isStockDetailPayload(json: unknown): json is StockDetailPayload {
  if (!json || typeof json !== "object") return false;
  const o = json as Record<string, unknown>;
  if (o.error === true) return false;
  return (
    typeof o.symbol === "string" &&
    typeof o.name === "string" &&
    typeof o.price === "number" &&
    typeof o.growthRateUsed === "number" &&
    isNullableNumber(o.intrinsicValue) &&
    isNullableNumber(o.cashFlowUsed) &&
    isNullableNumber(o.sharesOutstanding)
  );
}

function valuationLabelClass(
  label: "Undervalued" | "Fair" | "Overvalued",
): string {
  switch (label) {
    case "Undervalued":
      return "bg-emerald-50/90 text-emerald-900/90 ring-1 ring-emerald-200/60";
    case "Overvalued":
      return "bg-rose-50/90 text-rose-900/85 ring-1 ring-rose-200/55";
    default:
      return "bg-stone-100/80 text-intrinsic-ink/85 ring-1 ring-intrinsic-secondary/20";
  }
}

export function StockPageContent({ symbol }: Props) {
  const [data, setData] = useState<StockDetailPayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const [growthRate, setGrowthRate] = useState(0.05);
  const [discountRate, setDiscountRate] = useState(0.09);
  const [terminalGrowth, setTerminalGrowth] = useState(0.025);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (cancelled) return;
        const json: unknown = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok || json === null || isStockApiError(json)) {
          setData(null);
          setLoadError(true);
          return;
        }

        if (isStockDetailPayload(json)) {
          if (cancelled) return;
          setData(json);
          if (
            json.cashFlowUsed !== null &&
            json.sharesOutstanding !== null
          ) {
            setGrowthRate(json.growthRateUsed);
            setDiscountRate(0.09);
            setTerminalGrowth(0.025);
          }
          setLoadError(false);
        } else {
          setData(null);
          setLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const canValuate =
    data !== null &&
    data.cashFlowUsed !== null &&
    data.sharesOutstanding !== null;

  const liveValuation = useMemo(() => {
    if (
      !data ||
      data.cashFlowUsed === null ||
      data.sharesOutstanding === null
    ) {
      return {
        intrinsicValue: null as number | null,
        margin: null as number | null,
        label: null as "Undervalued" | "Fair" | "Overvalued" | null,
      };
    }
    const intrinsicValue = calculateDCF({
      cashFlow: data.cashFlowUsed,
      sharesOutstanding: data.sharesOutstanding,
      growthRate,
      discountRate,
      terminalGrowthRate: terminalGrowth,
    });
    const margin =
      intrinsicValue !== null
        ? marginOfSafetyPercent(intrinsicValue, data.price)
        : null;
    const label =
      margin !== null ? valuationLabelFromMargin(margin) : null;
    return { intrinsicValue, margin, label };
  }, [data, growthRate, discountRate, terminalGrowth]);

  const explanationText = useMemo(() => {
    if (!data || liveValuation.margin === null) return null;
    return buildValuationExplanation(
      liveValuation.margin,
      growthRate,
      discountRate,
    );
  }, [data, liveValuation.margin, growthRate, discountRate]);

  const unreliableEstimate = useMemo(() => {
    if (!data || liveValuation.intrinsicValue === null) return false;
    return isIntrinsicEstimatePotentiallyUnreliable(
      liveValuation.intrinsicValue,
      data.price,
    );
  }, [data, liveValuation.intrinsicValue]);

  return (
    <div className="flex w-full flex-1 flex-col items-center px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10">
      <div className="w-full max-w-4xl">
        <Link
          href="/"
          className="mb-8 inline-flex text-xs font-medium tracking-wide text-intrinsic-secondary/75 transition-colors duration-200 ease-out hover:text-intrinsic-ink sm:mb-10"
        >
          ← Back to home
        </Link>

        {loading ? (
          <p className="text-center text-lg text-intrinsic-secondary">
            {STOCK_PAGE_COPY.loading}
          </p>
        ) : null}

        {!loading && loadError ? (
          <p className="text-center text-lg text-intrinsic-secondary">
            {STOCK_PAGE_COPY.loadError}
          </p>
        ) : null}

        {!loading && !loadError && data ? (
          <div className="animate-stock-page-enter flex flex-col items-stretch gap-10 sm:gap-12">
            <header className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-x-8 lg:gap-y-4">
              <div className="flex flex-wrap items-center justify-center gap-2 lg:col-start-1 lg:row-start-1 lg:justify-start">
                <h1 className="text-5xl font-bold tracking-tight text-intrinsic-ink sm:text-6xl lg:text-7xl">
                  {data.symbol}
                </h1>
                <WatchlistStarButton symbol={data.symbol} />
              </div>
              <p className="text-center text-xl text-intrinsic-secondary sm:text-2xl lg:col-start-1 lg:row-start-2 lg:text-left">
                {data.name}
              </p>
              <div className="w-full lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
                <SearchBar
                  variant="compact"
                  placeholder="Search another stock..."
                  className="lg:max-w-[220px]"
                />
              </div>
              <p className="text-center text-4xl font-semibold tabular-nums tracking-tight text-intrinsic-ink sm:text-5xl lg:col-start-1 lg:row-start-3 lg:text-left">
                {formatCurrencyDisplay(data.price)}
              </p>
            </header>

            <section className="min-w-0">
              <StockPriceChart
                key={data.symbol}
                symbol={data.symbol}
                intrinsicValue={
                  canValuate ? liveValuation.intrinsicValue : null
                }
              />
              <p className="mt-3 text-center text-[11px] leading-relaxed text-intrinsic-secondary/85 sm:mt-4">
                {STOCK_PAGE_COPY.marketDataDelayNote}
              </p>
            </section>

            {!canValuate ? (
              <div className="rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light px-6 py-8 text-center sm:rounded-3xl sm:px-8 sm:py-10">
                <p className="font-medium text-intrinsic-ink">
                  {STOCK_PAGE_COPY.valuationUnavailableTitle}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-intrinsic-secondary sm:text-base">
                  {STOCK_PAGE_COPY.valuationUnavailableBody}
                </p>
              </div>
            ) : (
              <section className="rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light px-6 py-8 text-left shadow-sm sm:rounded-3xl sm:px-8 sm:py-10">
                <div className="flex flex-col gap-6 sm:gap-7">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-intrinsic-secondary">
                      Intrinsic value
                    </p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-intrinsic-ink sm:text-4xl">
                      {liveValuation.intrinsicValue !== null
                        ? formatCurrencyDisplay(liveValuation.intrinsicValue)
                        : "—"}
                    </p>
                    {unreliableEstimate ? (
                      <p className="mt-3 text-sm leading-relaxed text-intrinsic-secondary/90">
                        {STOCK_PAGE_COPY.unreliableEstimate}
                      </p>
                    ) : null}
                  </div>

                  {liveValuation.margin !== null && liveValuation.label ? (
                    <>
                      <div className="h-px bg-intrinsic-secondary/12" />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-widest text-intrinsic-secondary">
                          Margin of safety
                        </p>
                        <p
                          className={`mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${
                            liveValuation.label === "Undervalued"
                              ? "text-emerald-900/85"
                              : liveValuation.label === "Overvalued"
                                ? "text-rose-900/85"
                                : "text-intrinsic-ink"
                          }`}
                        >
                          {formatPercentOneDecimal(liveValuation.margin)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-widest text-intrinsic-secondary">
                          Valuation
                        </p>
                        <p
                          className={`mt-3 inline-block rounded-full px-4 py-2 text-sm font-semibold sm:text-base ${valuationLabelClass(liveValuation.label)}`}
                        >
                          {liveValuation.label}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
            )}

            {canValuate ? (
              <div className="border-b border-intrinsic-secondary/15 pb-1">
                <button
                  type="button"
                  onClick={() => setAssumptionsOpen((o) => !o)}
                  aria-expanded={assumptionsOpen}
                  className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm text-intrinsic-secondary transition-colors hover:text-intrinsic-ink"
                >
                  <span>Adjust assumptions</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 shrink-0 text-intrinsic-secondary transition-transform duration-200 ${
                      assumptionsOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {assumptionsOpen ? (
                  <div className="mt-4 space-y-6 border-t border-intrinsic-secondary/10 pt-5">
                    <p className="mb-4 text-sm leading-relaxed text-[#A69486]">
                      Adjust the assumptions below to see how your personal
                      outlook changes the valuation.
                    </p>
                    <div>
                      <div className="mb-2 flex justify-between gap-4 text-sm">
                        <span className="flex items-center text-intrinsic-secondary">
                          Growth rate
                          <Tooltip text="How fast you expect the company's cash flows to grow over the next 5 years. Higher means you're more optimistic about the company's future." />
                        </span>
                        <span className="tabular-nums text-intrinsic-ink/90">
                          {formatPercentOneDecimal(growthRate * 100)}
                        </span>
                      </div>
                      <input
                        type="range"
                        className="intrinsic-assumption-range"
                        min={0.02}
                        max={0.4}
                        step={0.005}
                        value={growthRate}
                        onChange={(e) =>
                          setGrowthRate(Number(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between gap-4 text-sm">
                        <span className="flex items-center text-intrinsic-secondary">
                          Discount rate
                          <Tooltip text="The annual return you require from this investment. A higher rate means you demand more from the stock before considering it a good buy." />
                        </span>
                        <span className="tabular-nums text-intrinsic-ink/90">
                          {formatPercentOneDecimal(discountRate * 100)}
                        </span>
                      </div>
                      <input
                        type="range"
                        className="intrinsic-assumption-range"
                        min={0.05}
                        max={0.15}
                        step={0.005}
                        value={discountRate}
                        onChange={(e) =>
                          setDiscountRate(Number(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between gap-4 text-sm">
                        <span className="flex items-center text-intrinsic-secondary">
                          Terminal growth
                          <Tooltip text="How fast you expect the company to grow indefinitely after year 5. This is usually kept close to long-term inflation, around 2-3%." />
                        </span>
                        <span className="tabular-nums text-intrinsic-ink/90">
                          {formatPercentOneDecimal(terminalGrowth * 100)}
                        </span>
                      </div>
                      <input
                        type="range"
                        className="intrinsic-assumption-range"
                        min={0.01}
                        max={0.04}
                        step={0.005}
                        value={terminalGrowth}
                        onChange={(e) =>
                          setTerminalGrowth(Number(e.target.value))
                        }
                      />
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setGrowthRate(data.growthRateUsed);
                          setDiscountRate(0.09);
                          setTerminalGrowth(0.025);
                        }}
                        className="text-xs text-intrinsic-secondary/90 underline-offset-2 hover:text-intrinsic-ink hover:underline"
                      >
                        Reset to defaults
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {canValuate && explanationText ? (
              <div className="flex flex-col gap-3">
                <p className="text-center text-xs font-medium uppercase tracking-widest text-intrinsic-secondary">
                  {STOCK_PAGE_COPY.explanationSectionTitle}
                </p>
                <div className="rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light px-6 py-6 text-left sm:rounded-3xl sm:px-8 sm:py-7">
                  <p className="text-base leading-relaxed text-intrinsic-ink">
                    {explanationText}
                  </p>
                  <p className="mt-4 text-xs leading-relaxed text-intrinsic-secondary/90 sm:text-sm">
                    {STOCK_PAGE_COPY.tfsaNote}
                  </p>
                </div>
              </div>
            ) : null}

            {canValuate ? (
              <section
                className="rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light/90 px-6 py-5 sm:rounded-3xl sm:px-8 sm:py-6"
                aria-label={STOCK_PAGE_COPY.modelAssumptionsTitle}
              >
                <p className="text-center text-xs font-medium uppercase tracking-widest text-intrinsic-secondary">
                  {STOCK_PAGE_COPY.modelAssumptionsTitle}
                </p>
                <dl className="mt-4 grid gap-2 text-sm text-intrinsic-secondary sm:grid-cols-2 sm:gap-x-8 sm:gap-y-2 sm:text-base">
                  <div className="flex justify-between gap-4 sm:justify-start sm:gap-8">
                    <dt>Growth rate</dt>
                    <dd className="tabular-nums text-intrinsic-ink/90">
                      {formatPercentOneDecimal(growthRate * 100)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:justify-start sm:gap-8">
                    <dt>Discount rate</dt>
                    <dd className="tabular-nums text-intrinsic-ink/90">
                      {formatPercentOneDecimal(discountRate * 100)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:justify-start sm:gap-8">
                    <dt>Terminal growth</dt>
                    <dd className="tabular-nums text-intrinsic-ink/90">
                      {formatPercentOneDecimal(terminalGrowth * 100)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:justify-start sm:gap-8">
                    <dt>Projection period</dt>
                    <dd className="tabular-nums text-intrinsic-ink/90">
                      {DCF_ASSUMPTIONS.projectionYears} years
                    </dd>
                  </div>
                </dl>
              </section>
            ) : null}

            <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-intrinsic-secondary/80">
              {STOCK_PAGE_COPY.disclaimer}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
