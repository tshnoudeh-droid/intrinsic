"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StockDetailPayload } from "@/lib/stock-detail-types";
import { DCF_ASSUMPTIONS } from "@/lib/calculate-intrinsic-value";
import { formatCurrencyDisplay, formatPercentOneDecimal } from "@/lib/format-display";
import { isIntrinsicEstimatePotentiallyUnreliable } from "@/lib/intrinsic-estimate-quality";
import { STOCK_PAGE_COPY } from "@/lib/stock-page-copy";
import { buildValuationExplanation } from "@/lib/valuation-explanation";
import { StockPriceChart } from "@/components/StockPriceChart";
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

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`)
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
          setData(json);
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

  const valuation = useMemo(() => {
    if (!data || data.intrinsicValue === null) return null;
    const margin = marginOfSafetyPercent(data.intrinsicValue, data.price);
    if (margin === null) return null;
    return {
      margin,
      label: valuationLabelFromMargin(margin),
    };
  }, [data]);

  const explanationText = useMemo(() => {
    if (!valuation) return null;
    return buildValuationExplanation(valuation.margin);
  }, [valuation]);

  const unreliableEstimate = useMemo(() => {
    if (!data || data.intrinsicValue === null) return false;
    return isIntrinsicEstimatePotentiallyUnreliable(
      data.intrinsicValue,
      data.price,
    );
  }, [data]);

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
            <header className="text-center">
              <h1 className="text-5xl font-bold tracking-tight text-intrinsic-ink sm:text-6xl">
                {data.symbol}
              </h1>
              <p className="mt-3 text-base text-intrinsic-secondary sm:text-lg">
                {data.name}
              </p>
              <p className="mt-6 text-4xl font-semibold tabular-nums tracking-tight text-intrinsic-ink sm:mt-7 sm:text-5xl">
                {formatCurrencyDisplay(data.price)}
              </p>
            </header>

            <section
              className="rounded-2xl border border-dashed border-intrinsic-secondary/25 bg-intrinsic-light/50 px-6 py-5 sm:rounded-3xl sm:px-8 sm:py-6"
              aria-label="Temporary valuation inputs (debug)"
            >
              <p className="text-center text-xs font-medium uppercase tracking-wider text-intrinsic-secondary">
                Debug (temporary)
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 sm:gap-x-8 sm:text-base">
                <div className="flex justify-between gap-4 sm:flex-col sm:justify-start sm:gap-1">
                  <dt className="text-intrinsic-secondary">Cash flow used</dt>
                  <dd className="tabular-nums text-intrinsic-ink/90">
                    {data.cashFlowUsed !== null
                      ? formatCurrencyDisplay(data.cashFlowUsed)
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:flex-col sm:justify-start sm:gap-1">
                  <dt className="text-intrinsic-secondary">Shares outstanding</dt>
                  <dd className="tabular-nums text-intrinsic-ink/90">
                    {data.sharesOutstanding !== null
                      ? data.sharesOutstanding.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })
                      : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            {data.intrinsicValue === null ? (
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
                    <p className="text-xs font-medium uppercase tracking-wider text-intrinsic-secondary">
                      Intrinsic value
                    </p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-intrinsic-ink sm:text-4xl">
                      {formatCurrencyDisplay(data.intrinsicValue)}
                    </p>
                    {unreliableEstimate ? (
                      <p className="mt-3 text-sm leading-relaxed text-intrinsic-secondary/90">
                        {STOCK_PAGE_COPY.unreliableEstimate}
                      </p>
                    ) : null}
                  </div>

                  {valuation ? (
                    <>
                      <div className="h-px bg-intrinsic-secondary/12" />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-intrinsic-secondary">
                          Margin of safety
                        </p>
                        <p
                          className={`mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${
                            valuation.label === "Undervalued"
                              ? "text-emerald-900/85"
                              : valuation.label === "Overvalued"
                                ? "text-rose-900/85"
                                : "text-intrinsic-ink"
                          }`}
                        >
                          {formatPercentOneDecimal(valuation.margin)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-intrinsic-secondary">
                          Valuation
                        </p>
                        <p
                          className={`mt-3 inline-block rounded-full px-4 py-2 text-sm font-semibold sm:text-base ${valuationLabelClass(valuation.label)}`}
                        >
                          {valuation.label}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
            )}

            {data.intrinsicValue !== null && explanationText ? (
              <div className="flex flex-col gap-3">
                <p className="text-center text-xs font-medium uppercase tracking-wider text-intrinsic-secondary">
                  {STOCK_PAGE_COPY.explanationSectionTitle}
                </p>
                <div className="rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light px-6 py-6 text-left sm:rounded-3xl sm:px-8 sm:py-7">
                  <p className="text-sm leading-relaxed text-intrinsic-ink sm:text-base">
                    {explanationText}
                  </p>
                  <p className="mt-4 text-xs leading-relaxed text-intrinsic-secondary/90 sm:text-sm">
                    {STOCK_PAGE_COPY.tfsaNote}
                  </p>
                </div>
              </div>
            ) : null}

            <section
              className="rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light/90 px-6 py-5 sm:rounded-3xl sm:px-8 sm:py-6"
              aria-label={STOCK_PAGE_COPY.modelAssumptionsTitle}
            >
              <p className="text-center text-xs font-medium uppercase tracking-wider text-intrinsic-secondary">
                {STOCK_PAGE_COPY.modelAssumptionsTitle}
              </p>
              <dl className="mt-4 grid gap-2 text-sm text-intrinsic-secondary sm:grid-cols-2 sm:gap-x-8 sm:gap-y-2 sm:text-base">
                <div className="flex justify-between gap-4 sm:justify-start sm:gap-8">
                  <dt>Growth rate</dt>
                  <dd className="tabular-nums text-intrinsic-ink/90">
                    {formatPercentOneDecimal(DCF_ASSUMPTIONS.growthRate * 100)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:justify-start sm:gap-8">
                  <dt>Discount rate</dt>
                  <dd className="tabular-nums text-intrinsic-ink/90">
                    {formatPercentOneDecimal(DCF_ASSUMPTIONS.discountRate * 100)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:justify-start sm:gap-8">
                  <dt>Terminal growth</dt>
                  <dd className="tabular-nums text-intrinsic-ink/90">
                    {formatPercentOneDecimal(
                      DCF_ASSUMPTIONS.terminalGrowthRate * 100,
                    )}
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

            <section className="min-w-0">
              <StockPriceChart
                key={data.symbol}
                symbol={data.symbol}
                intrinsicValue={data.intrinsicValue}
              />
            </section>

            <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-intrinsic-secondary/80">
              {STOCK_PAGE_COPY.disclaimer}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
