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
import { fetchStockHistory } from "@/lib/fetch-stock-history";
import type { HistoryPoint, HistoryRange } from "@/lib/history-types";

const RANGES: { key: HistoryRange; label: string }[] = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "1Y", label: "1Y" },
];

type Props = {
  symbol: string;
  intrinsicValue: number | null;
};

/** Parse `YYYY-MM-DD` as local calendar date (avoids UTC off-by-one in tooltips). */
function parseISODateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatTooltipDateLabel(iso: string): string {
  const d = parseISODateLocal(iso);
  if (!d) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAxisTick(iso: string, chartRange: HistoryRange): string {
  const d = parseISODateLocal(iso);
  if (!d) return iso;
  if (chartRange === "1Y") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  const price =
    typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(price)) return null;
  const iso = typeof label === "string" ? label : String(label);
  const dateLabel = formatTooltipDateLabel(iso);

  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-sm"
      style={{
        background: "#FAF8F4",
        border: "1px solid #EDE8DF",
        color: "#2a2622",
      }}
    >
      <p className="leading-snug">Date: {dateLabel}</p>
      <p className="mt-1 leading-snug tabular-nums">
        Price: $
        {price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  );
}

export function StockPriceChart({ symbol, intrinsicValue }: Props) {
  const [range, setRange] = useState<HistoryRange>("1M");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setFetchError(false);
      const result = await fetchStockHistory(symbol, range);
      if (cancelled) return;
      if (!result.ok) {
        setPoints([]);
        setFetchError(true);
      } else {
        setPoints(result.points);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const selectRange = useCallback((key: HistoryRange) => {
    if (key === range) return;
    setRange(key);
  }, [range]);

  const yDomain = useMemo(() => {
    if (points.length === 0) {
      return undefined as [number, number] | undefined;
    }
    const prices = points
      .map((d) => d.price)
      .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
    if (prices.length === 0) {
      return undefined as [number, number] | undefined;
    }
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const span = maxP - minP;
    const pad = span > 0 ? span * 0.1 : Math.abs(maxP) * 0.02 || 1;
    return [minP - pad, maxP + pad] as [number, number];
  }, [points]);

  const xTicks = useMemo(() => {
    if (points.length === 0) return undefined;
    const n = points.length;
    if (n <= 6) return points.map((p) => p.date);
    const maxTicks = 6;
    const step = Math.ceil((n - 1) / (maxTicks - 1));
    const ticks: string[] = [];
    for (let i = 0; i < n; i += step) {
      ticks.push(points[i].date);
    }
    const last = points[n - 1].date;
    if (ticks[ticks.length - 1] !== last) ticks.push(last);
    return ticks.slice(0, maxTicks);
  }, [points]);

  const intrinsicLabelMeta = useMemo(() => {
    if (
      intrinsicValue === null ||
      !Number.isFinite(intrinsicValue) ||
      yDomain === undefined
    ) {
      return { show: false as const };
    }
    const [low, high] = yDomain;
    const fmt = intrinsicValue.toFixed(2);
    if (intrinsicValue < low) {
      return {
        show: true as const,
        position: "insideBottomLeft" as const,
        value: `Intrinsic: $${fmt} ↓`,
      };
    }
    if (intrinsicValue > high) {
      return {
        show: true as const,
        position: "insideTopLeft" as const,
        value: `Intrinsic: $${fmt} ↑`,
      };
    }
    return { show: false as const };
  }, [intrinsicValue, yDomain]);

  return (
    <div className="w-full">
      <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-intrinsic-secondary">
        Price history
      </p>

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectRange(key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              range === key
                ? "bg-intrinsic-ink text-intrinsic-light shadow-md shadow-intrinsic-ink/15 ring-1 ring-intrinsic-ink/10"
                : "bg-intrinsic-light text-intrinsic-secondary shadow-sm ring-1 ring-intrinsic-secondary/15 hover:bg-intrinsic-accent/60 hover:text-intrinsic-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-intrinsic-secondary/10 bg-intrinsic-light p-4 shadow-md shadow-black/[0.04] ring-1 ring-black/[0.03] sm:rounded-3xl sm:p-6">
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
            No chart data available
          </p>
        ) : (
          <div className="h-[260px] w-full min-w-0 pb-7 sm:h-[300px] sm:pb-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#EDE8DF"
                  strokeOpacity={0.5}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  ticks={xTicks}
                  tick={{ fill: "var(--color-intrinsic-secondary)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-intrinsic-secondary)", strokeOpacity: 0.25 }}
                  tickFormatter={(v) => formatAxisTick(String(v), range)}
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
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#EDE8DF" }} />
                {intrinsicValue !== null && Number.isFinite(intrinsicValue) ? (
                  <ReferenceLine
                    y={intrinsicValue}
                    stroke="#A69486"
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    ifOverflow="visible"
                    label={
                      intrinsicLabelMeta.show
                        ? {
                            value: intrinsicLabelMeta.value,
                            position: intrinsicLabelMeta.position,
                            fill: "#A69486",
                            fontSize: 11,
                          }
                        : undefined
                    }
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="price"
                  name="Price"
                  stroke="#1a1a1a"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "#1a1a1a" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {!loading && points.length > 0 ? (
          <div className="pointer-events-none absolute bottom-3 right-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-intrinsic-secondary/80 sm:bottom-4 sm:right-6">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-px w-5 bg-[#1a1a1a]"
                aria-hidden
              />
              Price
            </span>
            {intrinsicValue !== null && Number.isFinite(intrinsicValue) ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-5 border-t border-dashed border-[#A69486]"
                  aria-hidden
                />
                Intrinsic value
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
