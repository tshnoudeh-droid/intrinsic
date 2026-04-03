"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoryPoint } from "@/lib/history-types";

type Props = {
  symbol: string;
  intrinsicValue: number | null;
};

/**
 * DEBUG MODE — hardcoded 90-day /api/history (AAPL on server), minimal Recharts, range buttons off.
 */
export function StockPriceChart(props: Props) {
  void props.symbol;
  void props.intrinsicValue;
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/history?symbol=AAPL&range=3M`,
          { cache: "no-store" },
        );
        const json: unknown = await res.json();
        if (cancelled) return;
        const arr = Array.isArray(json) ? json : [];
        console.log("FRONTEND DATA:", arr);
        setData(
          arr.filter(
            (row): row is HistoryPoint =>
              row !== null &&
              typeof row === "object" &&
              "date" in row &&
              "price" in row &&
              typeof (row as HistoryPoint).date === "string" &&
              typeof (row as HistoryPoint).price === "number",
          ),
        );
      } catch {
        if (!cancelled) setData([]);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full">
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-intrinsic-secondary">
          Price history (DEBUG)
        </p>
        <p className="py-16 text-center text-sm text-intrinsic-secondary">Loading chart...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return <div>NO DATA RETURNED</div>;
  }

  return (
    <div className="w-full">
      <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-intrinsic-secondary">
        Price history (DEBUG — 90d fixed, AAPL)
      </p>
      <p className="mb-2 text-center text-xs text-intrinsic-secondary">
        Range controls disabled — DEBUG MODE
      </p>
      <p className="mb-3 text-center text-xs tabular-nums text-intrinsic-secondary/90">
        Data points: {data.length}
      </p>

      <div className="h-[300px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="price" stroke="#000" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
