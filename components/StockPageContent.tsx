"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StockDetailPayload } from "@/lib/stock-detail-types";
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

function isStockDetailPayload(json: unknown): json is StockDetailPayload {
  if (!json || typeof json !== "object") return false;
  const o = json as Record<string, unknown>;
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
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          setData(null);
          return;
        }
        const json: unknown = await res.json();
        if (isStockDetailPayload(json)) {
          setData(json);
          setError(false);
        } else {
          setError(true);
          setData(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setData(null);
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
          <p className="text-center text-lg text-intrinsic-secondary">Loading...</p>
        ) : null}

        {!loading && error ? (
          <p className="text-center text-lg text-intrinsic-secondary">
            Failed to load stock data
          </p>
        ) : null}

        {!loading && !error && data ? (
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
              <div className="rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light px-6 py-8 text-center text-intrinsic-secondary sm:rounded-3xl sm:px-8 sm:py-10">
                Valuation unavailable
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
