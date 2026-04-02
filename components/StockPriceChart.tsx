"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryPoint, HistoryRange } from "@/lib/history-types";

const RANGES: { key: HistoryRange; label: string }[] = [
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
];

type Props = {
  symbol: string;
  intrinsicValue: number | null;
};

function parseHistoryPayload(json: unknown): HistoryPoint[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (row): row is HistoryPoint =>
      row !== null &&
      typeof row === "object" &&
      "date" in row &&
      "price" in row &&
      typeof (row as HistoryPoint).date === "string" &&
      typeof (row as HistoryPoint).price === "number",
  );
}

export function StockPriceChart({ symbol, intrinsicValue }: Props) {
  const [range, setRange] = useState<HistoryRange>("1m");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const res = await fetch(
        `/api/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`,
      );
      if (cancelled) return;
      if (!res.ok) {
        setPoints([]);
        setFetchError(true);
        return;
      }
      const json: unknown = await res.json();
      if (cancelled) return;
      setPoints(parseHistoryPayload(json));
      setFetchError(false);
    };

    run()
      .catch(() => {
        if (!cancelled) {
          setPoints([]);
          setFetchError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const selectRange = useCallback((key: HistoryRange) => {
    if (key === range) return;
    setLoading(true);
    setRange(key);
  }, [range]);

  const yDomain = useMemo(() => {
    if (points.length === 0) return undefined;
    const prices = points.map((p) => p.price);
    const candidates =
      intrinsicValue !== null && Number.isFinite(intrinsicValue)
        ? [...prices, intrinsicValue]
        : prices;
    const min = Math.min(...candidates);
    const max = Math.max(...candidates);
    const pad = max === min ? Math.abs(min) * 0.02 || 1 : (max - min) * 0.06;
    return [min - pad, max + pad] as [number, number];
  }, [points, intrinsicValue]);

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-3 flex justify-center gap-2">
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectRange(key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              range === key
                ? "bg-intrinsic-ink text-intrinsic-light"
                : "bg-intrinsic-light text-intrinsic-secondary hover:bg-intrinsic-accent/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-intrinsic-secondary/15 bg-intrinsic-light/80 p-3 sm:p-4">
        {loading ? (
          <p className="py-16 text-center text-sm text-intrinsic-secondary">
            Loading chart...
          </p>
        ) : fetchError ? (
          <p className="py-16 text-center text-sm text-intrinsic-secondary">
            Unable to load chart data.
          </p>
        ) : points.length === 0 ? (
          <p className="py-16 text-center text-sm text-intrinsic-secondary">
            No chart data available for this range.
          </p>
        ) : (
          <div className="h-[280px] w-full sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke="var(--color-intrinsic-secondary)"
                  strokeOpacity={0.12}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--color-intrinsic-secondary)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-intrinsic-secondary)", strokeOpacity: 0.25 }}
                  minTickGap={28}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fill: "var(--color-intrinsic-secondary)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v) =>
                    typeof v === "number"
                      ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-intrinsic-light)",
                    border: "1px solid rgba(166, 148, 134, 0.25)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(label) => String(label)}
                  formatter={(value) => [
                    typeof value === "number"
                      ? value.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : String(value),
                    "Price",
                  ]}
                />
                {intrinsicValue !== null && Number.isFinite(intrinsicValue) ? (
                  <ReferenceLine
                    y={intrinsicValue}
                    stroke="var(--color-intrinsic-secondary)"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    ifOverflow="extendDomain"
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="price"
                  name="Price"
                  stroke="var(--color-intrinsic-ink)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-intrinsic-ink)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!loading && points.length > 0 && intrinsicValue !== null ? (
          <p className="mt-2 text-center text-xs text-intrinsic-secondary">
            Dashed line: intrinsic value
          </p>
        ) : null}
      </div>
    </div>
  );
}
