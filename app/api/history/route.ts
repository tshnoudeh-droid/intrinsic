import { NextRequest, NextResponse } from "next/server";
import type { HistoryPoint, HistoryRange } from "@/lib/history-types";
import { CACHE_HEADERS_NO_STORE } from "@/lib/http-cache-headers";
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

/** Prefer split-adjusted close so long-range charts match exchange-style adjusted series. */
function priceFromHistoricalRow(row: Record<string, unknown>): number | null {
  const adj = num(row.adjClose);
  if (adj !== null && adj > 0) return adj;
  const cls = num(row.close);
  if (cls !== null && cls > 0) return cls;
  return null;
}

function formatChartDate(d: Date): string {
  return d.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function dayKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sameCalendarDayUTC(a: Date, b: Date): boolean {
  return dayKeyUTC(a) === dayKeyUTC(b);
}

function coerceQuoteTime(quote: Record<string, unknown>): Date | null {
  const t = quote.regularMarketTime;
  if (t instanceof Date && !Number.isNaN(t.getTime())) return t;
  if (typeof t === "number" && Number.isFinite(t)) {
    const ms = t > 1e12 ? t : t * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

type Bar = { date: Date; price: number };

function mergeLatestQuote(
  bars: Bar[],
  quoteUnknown: unknown,
  livePrice: number | null,
): void {
  if (bars.length === 0 || livePrice === null || livePrice <= 0) return;
  if (!quoteUnknown || typeof quoteUnknown !== "object") return;
  const quote = quoteUnknown as Record<string, unknown>;
  const last = bars[bars.length - 1];
  const qt = coerceQuoteTime(quote);

  if (qt !== null) {
    if (sameCalendarDayUTC(qt, last.date)) {
      last.price = livePrice;
      return;
    }
    if (qt.getTime() > last.date.getTime()) {
      bars.push({ date: qt, price: livePrice });
    }
    return;
  }

  if (livePrice !== null) {
    if (sameCalendarDayUTC(last.date, new Date())) {
      last.price = livePrice;
    }
  }
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  const rawRange = request.nextUrl.searchParams.get("range");

  if (!symbol) {
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
    const [results, quoteRaw] = await Promise.all([
      yahooFinance.historical(symbol, {
        period1: from,
        period2: to,
        interval: "1d",
      }),
      yahooFinance.quote(symbol),
    ]);

    const quote = Array.isArray(quoteRaw) ? quoteRaw[0] : quoteRaw;
    const livePrice =
      quote && typeof quote === "object"
        ? num((quote as { regularMarketPrice?: unknown }).regularMarketPrice)
        : null;

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json([] satisfies HistoryPoint[], {
        headers: CACHE_HEADERS_NO_STORE,
      });
    }

    const bars: Bar[] = [];

    for (const row of results) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const d = r.date;
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
      const price = priceFromHistoricalRow(r);
      if (price === null) continue;
      bars.push({ date: d, price });
    }

    bars.sort((a, b) => a.date.getTime() - b.date.getTime());

    mergeLatestQuote(bars, quote, livePrice);

    const chartData: HistoryPoint[] = bars.map((b) => ({
      date: formatChartDate(b.date),
      price: b.price,
    }));

    return NextResponse.json(chartData, { headers: CACHE_HEADERS_NO_STORE });
  } catch {
    return NextResponse.json([] satisfies HistoryPoint[], {
      headers: CACHE_HEADERS_NO_STORE,
    });
  }
}
