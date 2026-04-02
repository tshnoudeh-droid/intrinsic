"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StockDetailPayload } from "@/lib/stock-detail-types";
import { isIntrinsicEstimatePotentiallyUnreliable } from "@/lib/intrinsic-estimate-quality";
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
    isNullableNumber(o.intrinsicValue)
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
          className="mb-8 inline-flex text-xs font-medium tracking-wide text-intrinsic-secondary/75 transition-colors hover:text-intrinsic-ink sm:mb-10"
        >
          ← Back to home
        </Link>

        {loading ? (
          <p className="text-center text-lg text-intrinsic-secondary">
            Loading stock data...
          </p>
        ) : null}

        {!loading && loadError ? (
          <p className="text-center text-lg text-intrinsic-secondary">
            Failed to load data. Please try again.
          </p>
        ) : null}

        {!loading && !loadError && data ? (
          <div className="flex flex-col items-stretch gap-10 sm:gap-12">
            <header className="text-center">
              <h1 className="text-5xl font-bold tracking-tight text-intrinsic-ink sm:text-6xl">
                {data.symbol}
              </h1>
              <p className="mt-3 text-base text-intrinsic-secondary sm:text-lg">
                {data.name}
              </p>
              <p className="mt-6 text-4xl font-semibold tabular-nums tracking-tight text-intrinsic-ink sm:mt-7 sm:text-5xl">
                {data.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </header>

            {data.intrinsicValue === null ? (
              <div className="rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light px-6 py-8 text-center sm:rounded-3xl sm:px-8 sm:py-10">
                <p className="font-medium text-intrinsic-ink">Valuation unavailable</p>
                <p className="mt-3 text-sm leading-relaxed text-intrinsic-secondary sm:text-base">
                  This stock does not have sufficient financial data for a reliable
                  valuation.
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
                      $
                      {data.intrinsicValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    {unreliableEstimate ? (
                      <p className="mt-3 text-sm leading-relaxed text-intrinsic-secondary/90">
                        Estimate may be unreliable due to data limitations.
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
                          {valuation.margin.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}
                          %
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

            <section className="min-w-0">
              <StockPriceChart
                key={data.symbol}
                symbol={data.symbol}
                intrinsicValue={data.intrinsicValue}
              />
            </section>

            <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-intrinsic-secondary/80">
              Intrinsic values are estimates based on simplified financial models and
              should not be considered financial advice.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
