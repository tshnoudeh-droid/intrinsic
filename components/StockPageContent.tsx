"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StockDetailPayload } from "@/lib/stock-detail-types";
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
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-16 text-center sm:gap-10 sm:py-20">
      {loading ? (
        <p className="text-lg text-intrinsic-secondary">Loading...</p>
      ) : null}

      {!loading && error ? (
        <p className="max-w-md text-lg text-intrinsic-secondary">
          Failed to load stock data
        </p>
      ) : null}

      {!loading && !error && data ? (
        <div className="flex max-w-lg flex-col items-center gap-6 sm:gap-8">
          <div className="flex flex-col items-center gap-4 sm:gap-5">
            <h1 className="text-4xl font-semibold tracking-tight text-intrinsic-ink sm:text-5xl">
              {data.symbol}
            </h1>
            <p className="text-lg text-intrinsic-secondary sm:text-xl">{data.name}</p>
            <p className="text-4xl font-bold tabular-nums text-intrinsic-ink sm:text-5xl">
              {data.price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          <div className="flex w-full max-w-md flex-col gap-3 text-left text-base text-intrinsic-secondary sm:text-lg">
            {data.intrinsicValue === null ? (
              <p className="text-center">Valuation unavailable</p>
            ) : (
              <>
                <p>
                  <span className="text-intrinsic-ink">Intrinsic Value: </span>
                  <span className="font-medium text-intrinsic-ink">
                    $
                    {data.intrinsicValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </p>
                {valuation ? (
                  <>
                    <p>
                      <span className="text-intrinsic-ink">Margin of Safety: </span>
                      <span className="font-medium text-intrinsic-ink">
                        {valuation.margin.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </p>
                    <p className="text-center text-lg font-semibold text-intrinsic-ink">
                      {valuation.label}
                    </p>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      <Link
        href="/"
        className="text-sm font-medium text-intrinsic-secondary underline-offset-4 hover:underline"
      >
        Back to home
      </Link>
    </div>
  );
}
