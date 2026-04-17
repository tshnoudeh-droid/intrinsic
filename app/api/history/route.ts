import { NextRequest, NextResponse } from "next/server";
import type { HistoryPoint, HistoryRange } from "@/lib/history-types";
import { CACHE_HEADERS_NO_STORE } from "@/lib/http-cache-headers";
import { normalizeSymbol } from "@/lib/symbol-normalize";
import YahooFinance from "yahoo-finance2";

export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance();

const RANGE_DAYS: Record<HistoryRange, number> = {
  "1M": 35,
  "3M": 100,
  "1Y": 380,
};

function normalizeRange(param: string | null): HistoryRange | null {
  if (param === null || param.trim() === "") return null;
  const u = param.trim().toUpperCase();
  if (u === "1M" || u === "3M" || u === "1Y") {
    return u as HistoryRange;
  }
  return null;
}

function num(x: unknown): number | null {
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  return x;
}

/**
 * Split-adjusted close for the full series (internally consistent on 1Y+ spans).
 * Do not mix this with raw/last-sale quote prices — that distorted long-range charts.
 */
function priceFromHistoricalRow(row: Record<string, unknown>): number | null {
  const adj = num(row.adjClose);
  if (adj !== null && adj > 0) return adj;
  const cls = num(row.close);
  if (cls !== null && cls > 0) return cls;
  return null;
}

/** Trading-day key stable for sorting and unique X-axis values (avoids duplicate "Nov 24"). */
function toISODateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Bar = { date: Date; price: number };

export async function GET(request: NextRequest) {
  const rawSymbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  const symbol = normalizeSymbol(rawSymbol);
  const rawRange = request.nextUrl.searchParams.get("range");

  if (!rawSymbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400, headers: CACHE_HEADERS_NO_STORE },
    );
  }

  const resolvedRange: HistoryRange =
    rawRange === null || rawRange.trim() === ""
      ? "1M"
      : normalizeRange(rawRange) ?? "1M";

  if (
    rawRange !== null &&
    rawRange.trim() !== "" &&
    !normalizeRange(rawRange)
  ) {
    return NextResponse.json(
      { error: "Invalid range. Use 1M, 3M, or 1Y." },
      { status: 400, headers: CACHE_HEADERS_NO_STORE },
    );
  }

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - RANGE_DAYS[resolvedRange]);

  try {
    const results = await yahooFinance.historical(symbol, {
      period1: from,
      period2: to,
      interval: "1d",
    });

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json([] satisfies HistoryPoint[], {
        headers: CACHE_HEADERS_NO_STORE,
      });
    }

    const byDay = new Map<string, Bar>();

    for (const row of results) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const d = r.date;
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
      const price = priceFromHistoricalRow(r);
      if (price === null) continue;
      const key = toISODateKey(d);
      byDay.set(key, { date: d, price });
    }

    const bars = [...byDay.values()].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    const chartData: HistoryPoint[] = bars.map((b) => ({
      date: toISODateKey(b.date),
      price: b.price,
    }));

    return NextResponse.json(chartData, { headers: CACHE_HEADERS_NO_STORE });
  } catch {
    return NextResponse.json([] satisfies HistoryPoint[], {
      headers: CACHE_HEADERS_NO_STORE,
    });
  }
}
