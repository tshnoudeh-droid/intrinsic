"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KeyStats } from "@/components/KeyStats";
import type {
  GrowthSource,
  StockDetailPayload,
} from "@/lib/stock-detail-types";
import { calculateDCF } from "@/lib/calculate-dcf-client";
import { DCF_ASSUMPTIONS } from "@/lib/calculate-intrinsic-value";
import { formatCurrencyDisplay, formatPercentOneDecimal } from "@/lib/format-display";
import { isIntrinsicEstimatePotentiallyUnreliable } from "@/lib/intrinsic-estimate-quality";
import {
  STOCK_PAGE_COPY,
  VALUATION_UNAVAILABLE_BODY_BY_REASON,
} from "@/lib/stock-page-copy";
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

function isNullishFiniteNumber(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isFinite(v));
}

function isUnavailableReasonField(
  v: unknown,
): v is StockDetailPayload["unavailableReason"] {
  return (
    v === null ||
    v === "no_cash_flow_data" ||
    v === "negative_cash_flow" ||
    v === "no_shares_data" ||
    v === "insufficient_data" ||
    v === "calculation_error" ||
    v === "negative_result" ||
    v === "terminal_rate_too_close"
  );
}

function isCashFlowSourceField(
  v: unknown,
): v is StockDetailPayload["cashFlowSource"] {
  return (
    v === null ||
    v === "freeCashflow" ||
    v === "computed" ||
    v === "operatingOnly" ||
    v === "earnings"
  );
}

function isGrowthSourceField(v: unknown): v is GrowthSource {
  return v === "analyst" || v === "historical" || v === "default";
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
    isGrowthSourceField(o.growthSource) &&
    typeof o.discountRateUsed === "number" &&
    isNullableNumber(o.intrinsicValue) &&
    isNullableNumber(o.cashFlowUsed) &&
    isCashFlowSourceField(o.cashFlowSource) &&
    isNullableNumber(o.sharesOutstanding) &&
    isUnavailableReasonField(o.unavailableReason) &&
    isNullishFiniteNumber(o.marketCap) &&
    isNullishFiniteNumber(o.peRatio) &&
    isNullishFiniteNumber(o.forwardPE) &&
    isNullishFiniteNumber(o.revenueGrowth) &&
    isNullishFiniteNumber(o.week52High) &&
    isNullishFiniteNumber(o.week52Low) &&
    isNullishFiniteNumber(o.regularMarketTime) &&
    (o.regulatoryNote === undefined ||
      o.regulatoryNote === null ||
      typeof o.regulatoryNote === "string")
  );
}

function valuationUnavailableBody(
  reason: StockDetailPayload["unavailableReason"],
): string {
  if (reason === null) {
    return STOCK_PAGE_COPY.valuationUnavailableBody;
  }
  return VALUATION_UNAVAILABLE_BODY_BY_REASON[reason];
}

function valuationCardContextLine(
  label: "Undervalued" | "Fair" | "Overvalued",
  margin: number,
): string | null {
  if (label === "Fair") {
    return STOCK_PAGE_COPY.valuationCardFairNote;
  }
  if (label === "Overvalued" && margin < -60) {
    return STOCK_PAGE_COPY.valuationCardOvervaluedExtremeNote;
  }
  if (label === "Undervalued" && margin > 80) {
    return STOCK_PAGE_COPY.valuationCardUndervaluedStrongNote;
  }
  return null;
}

function growthSourceShortLabel(source: GrowthSource): string {
  switch (source) {
    case "analyst":
      return "Analyst estimate";
    case "historical":
      return "Historical";
    default:
      return "Default";
  }
}

const GROWTH_SLIDER_ADJUSTMENT_RANGE = 0.3;

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
  const [discountRate, setDiscountRate] = useState(0.06);
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
            setDiscountRate(0.06);
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

  const growthSliderMin = useMemo(
    () =>
      data
        ? Math.max(0, data.growthRateUsed - GROWTH_SLIDER_ADJUSTMENT_RANGE)
        : 0,
    [data],
  );

  const growthSliderMax = useMemo(
    () =>
      data
        ? Math.min(0.6, data.growthRateUsed + GROWTH_SLIDER_ADJUSTMENT_RANGE)
        : 0.6,
    [data],
  );

  /** Clamped to slider bounds so DCF and UI stay consistent if bounds change (e.g. new symbol). */
  const appliedGrowthRate = useMemo(() => {
    if (!data) return growthRate;
    return Math.min(
      growthSliderMax,
      Math.max(growthSliderMin, growthRate),
    );
  }, [data, growthRate, growthSliderMin, growthSliderMax]);

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
      growthRate: appliedGrowthRate,
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
  }, [data, appliedGrowthRate, discountRate, terminalGrowth]);

  const explanationText = useMemo(() => {
    if (
      !data ||
      liveValuation.margin === null ||
      liveValuation.label === null ||
      liveValuation.intrinsicValue === null
    ) {
      return null;
    }
    return buildValuationExplanation(
      data.name,
      liveValuation.margin,
      appliedGrowthRate,
      data.growthSource,
      discountRate,
      liveValuation.label,
      data.price,
      liveValuation.intrinsicValue,
    );
  }, [
    data,
    liveValuation.margin,
    liveValuation.label,
    liveValuation.intrinsicValue,
    appliedGrowthRate,
    discountRate,
  ]);

  const unreliableEstimate = useMemo(() => {
    if (!data || liveValuation.intrinsicValue === null) return false;
    return isIntrinsicEstimatePotentiallyUnreliable(
      liveValuation.intrinsicValue,
      data.price,
    );
  }, [data, liveValuation.intrinsicValue]);

  const slidersAdjustedFromDefaults = useMemo(() => {
    if (!data) return false;
    return (
      appliedGrowthRate !== data.growthRateUsed ||
      discountRate !== 0.06 ||
      terminalGrowth !== 0.025
    );
  }, [data, appliedGrowthRate, discountRate, terminalGrowth]);

  const showTerminalVersusDiscountWarning = useMemo(() => {
    if (!canValuate || !data) return false;
    if (liveValuation.intrinsicValue !== null) return false;
    if (!slidersAdjustedFromDefaults) return false;
    return discountRate - terminalGrowth <= 0.005;
  }, [
    canValuate,
    data,
    liveValuation.intrinsicValue,
    slidersAdjustedFromDefaults,
    discountRate,
    terminalGrowth,
  ]);

  const extremeValuationBannerText = useMemo(() => {
    if (!canValuate || liveValuation.margin === null) return null;
    const m = liveValuation.margin;
    if (m < -60) return STOCK_PAGE_COPY.extremeOvervaluedBanner;
    if (m > 80) return STOCK_PAGE_COPY.extremeUndervaluedBanner;
    return null;
  }, [canValuate, liveValuation.margin]);

  const valuationContextNote = useMemo(() => {
    if (
      !canValuate ||
      liveValuation.margin === null ||
      liveValuation.label === null
    ) {
      return null;
    }
    return valuationCardContextLine(liveValuation.label, liveValuation.margin);
  }, [canValuate, liveValuation.margin, liveValuation.label]);

  return (
    <div className="flex w-full flex-1 flex-col items-center px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10">
      <div className="w-full max-w-4xl">
        <Link
          href="/explore"
          className="mb-8 inline-flex text-xs font-medium tracking-wide text-intrinsic-secondary/75 transition-colors duration-200 ease-out hover:text-intrinsic-ink sm:mb-10"
        >
          ← Back to search
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
              <div className="text-center lg:col-start-1 lg:row-start-3 lg:text-left">
                <p className="text-4xl font-semibold tabular-nums tracking-tight text-intrinsic-ink sm:text-5xl">
                  {formatCurrencyDisplay(data.price)}
                </p>
                {data.regularMarketTime !== null &&
                Number.isFinite(data.regularMarketTime) ? (
                  <p
                    className="mt-1 text-xs font-normal tabular-nums"
                    style={{ color: "#A69486" }}
                  >
                    As of{" "}
                    {new Date(data.regularMarketTime * 1000).toLocaleTimeString(
                      "en-US",
                      {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "America/New_York",
                        timeZoneName: "short",
                      },
                    )}{" "}
                    · 15-min delay
                  </p>
                ) : null}
              </div>
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
                  {valuationUnavailableBody(data.unavailableReason)}
                </p>
                <p className="mt-4 text-xs leading-relaxed text-[#A69486]">
                  {STOCK_PAGE_COPY.valuationUnavailableDcfNote}
                </p>
              </div>
            ) : (
              <>
                {extremeValuationBannerText ? (
                  <div
                    className="mb-6 border-l-[3px] border-[#A69486] bg-[#FAF8F4] p-4 text-sm leading-relaxed text-[#5a4a3f] rounded-r-lg"
                    role="status"
                  >
                    {extremeValuationBannerText}
                  </div>
                ) : null}
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
                    {showTerminalVersusDiscountWarning ? (
                      <p className="mt-3 text-xs leading-relaxed text-[#A69486]">
                        Terminal growth rate must be lower than the discount
                        rate.
                      </p>
                    ) : null}
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
                        {valuationContextNote ? (
                          <p className="mt-2 text-xs leading-relaxed text-[#A69486]">
                            {valuationContextNote}
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
              </>
            )}

            {data.regulatoryNote ? (
              <div
                className="border-l-[3px] border-[#A69486] bg-[#FAF8F4] p-4 text-sm leading-relaxed text-[#5a4a3f] rounded-r-lg"
                role="note"
              >
                {data.regulatoryNote}
              </div>
            ) : null}

            <KeyStats
              marketCap={data.marketCap}
              peRatio={data.peRatio}
              forwardPE={data.forwardPE}
              revenueGrowth={data.revenueGrowth}
              week52High={data.week52High}
              week52Low={data.week52Low}
            />

            {canValuate ? (
              <div className="border-b border-intrinsic-secondary/15 pb-1">
                <button
                  type="button"
                  onClick={() => setAssumptionsOpen((o) => !o)}
                  aria-expanded={assumptionsOpen}
                  className="group relative flex w-full items-center justify-center rounded-full border border-[#A69486] bg-[#EDE8DF] py-2 pl-6 pr-12 text-center text-sm font-medium text-[#5a4a3f] transition-colors duration-200 ease-out hover:bg-[#d9d3c9]"
                >
                  <span>Adjust assumptions</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`absolute right-4 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-[#5a4a3f] transition-transform duration-200 ease-out ${
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
                          <Tooltip text="The expected annual growth in cash flows. We use analyst consensus estimates where available, falling back to historical revenue growth for smaller or less-covered stocks." />
                        </span>
                        <span className="tabular-nums text-intrinsic-ink/90">
                          {formatPercentOneDecimal(appliedGrowthRate * 100)}
                        </span>
                      </div>
                      <input
                        type="range"
                        className="intrinsic-assumption-range"
                        min={growthSliderMin}
                        max={growthSliderMax}
                        step={0.005}
                        value={appliedGrowthRate}
                        onChange={(e) =>
                          setGrowthRate(Number(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between gap-4 text-sm">
                        <span className="flex items-center text-intrinsic-secondary">
                          Discount rate
                          <Tooltip text="The annual return you require from this investment. We default to 6% — roughly the 30-year US Treasury yield plus a small premium for equity risk. Buffett uses the treasury yield alone (~4.9%). Raise this if you want a larger margin of safety." />
                        </span>
                        <span className="tabular-nums text-intrinsic-ink/90">
                          {formatPercentOneDecimal(discountRate * 100)}
                        </span>
                      </div>
                      <input
                        type="range"
                        className="intrinsic-assumption-range"
                        min={0.04}
                        max={0.12}
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
                          setDiscountRate(0.06);
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
                </div>
              </div>
            ) : null}

            {canValuate ? (
              <section
                className="py-1"
                aria-label={STOCK_PAGE_COPY.modelAssumptionsTitle}
              >
                <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-intrinsic-secondary">
                  {STOCK_PAGE_COPY.modelAssumptionsTitle}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:flex sm:flex-nowrap sm:justify-between sm:gap-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-1 border-b border-intrinsic-secondary/10 pb-4 sm:border-b-0 sm:border-r sm:border-intrinsic-secondary/15 sm:pb-0 sm:pr-5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-intrinsic-secondary/90">
                      Growth rate
                    </span>
                    <span className="text-sm tabular-nums text-intrinsic-ink">
                      {formatPercentOneDecimal(appliedGrowthRate * 100)}
                    </span>
                    <span className="text-xs text-[#A69486]">
                      {growthSourceShortLabel(data.growthSource)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 border-b border-intrinsic-secondary/10 pb-4 sm:border-b-0 sm:border-r sm:border-intrinsic-secondary/15 sm:px-5 sm:pb-0">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-intrinsic-secondary/90">
                      Discount rate
                    </span>
                    <span className="text-sm tabular-nums text-intrinsic-ink">
                      {formatPercentOneDecimal(discountRate * 100)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 border-b border-intrinsic-secondary/10 pb-4 sm:border-b-0 sm:border-r sm:border-intrinsic-secondary/15 sm:px-5 sm:pb-0">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-intrinsic-secondary/90">
                      Terminal growth
                    </span>
                    <span className="text-sm tabular-nums text-intrinsic-ink">
                      {formatPercentOneDecimal(terminalGrowth * 100)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 sm:pl-5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-intrinsic-secondary/90">
                      Period
                    </span>
                    <span className="text-sm tabular-nums text-intrinsic-ink">
                      {DCF_ASSUMPTIONS.projectionYears} years
                    </span>
                  </div>
                </div>
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
