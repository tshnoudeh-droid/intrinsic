import { NextRequest, NextResponse } from "next/server";
import type { HistoryPoint, HistoryRange } from "@/lib/history-types";

export const dynamic = "force-dynamic";

const FINNHUB_CANDLE = "https://finnhub.io/api/v1/stock/candle";

/** Days per range; `from = to - rangeInDays * 86400` with `to` in seconds. */
const RANGE_DAYS: Record<HistoryRange, number> = {
  "1M": 30,
  "3M": 90,
  "1Y": 365,
};

type FinnhubCandles = {
  s?: string;
  c?: number[];
  t?: number[];
};

function normalizeRange(param: string | null): HistoryRange | null {
  if (param === null || param.trim() === "") return null;
  const u = param.trim().toUpperCase();
  if (u === "1M" || u === "3M" || u === "1Y") {
    return u as HistoryRange;
  }
  return null;
}

const DEBUG_HISTORY =
  process.env.NODE_ENV === "development" ||
  process.env.STOCK_DEBUG_FINNHUB === "1" ||
  process.env.HISTORY_DEBUG_FINNHUB === "1";

/**
 * US listings use plain tickers (e.g. AAPL); many TSX names need `.TO`.
 * If the symbol has no exchange suffix, try the raw symbol first, then `SYMBOL.TO`.
 */
function candleSymbolVariants(symbol: string): string[] {
  const s = symbol.trim().toUpperCase();
  if (!s) return [];
  if (s.includes(".")) return [s];
  return [s, `${s}.TO`];
}

function mapCandlesToPoints(data: FinnhubCandles): HistoryPoint[] {
  const c = data.c;
  const t = data.t;
  if (!Array.isArray(c) || !Array.isArray(t) || c.length === 0) {
    return [];
  }
  const n = Math.min(t.length, c.length);
  const out: HistoryPoint[] = [];
  for (let i = 0; i < n; i++) {
    const time = t[i];
    const close = c[i];
    if (typeof time !== "number" || typeof close !== "number") continue;
    const price = Number(close);
    if (!Number.isFinite(price)) continue;
    out.push({
      date: new Date(time * 1000).toLocaleDateString(),
      price,
    });
  }
  return out;
}

async function fetchCandlesForSymbol(
  symbol: string,
  fromSec: number,
  toSec: number,
  token: string,
): Promise<FinnhubCandles | null> {
  const url = new URL(FINNHUB_CANDLE);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", "D");
  url.searchParams.set("from", String(fromSec));
  url.searchParams.set("to", String(toSec));
  url.searchParams.set("token", token);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as FinnhubCandles;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  const rawRange = request.nextUrl.searchParams.get("range");

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400 },
    );
  }

  let resolvedRange: HistoryRange;
  if (rawRange === null || rawRange.trim() === "") {
    resolvedRange = "1M";
  } else {
    const parsed = normalizeRange(rawRange);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid range. Use 1M, 3M, or 1Y." },
        { status: 400 },
      );
    }
    resolvedRange = parsed;
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "History is not configured" },
      { status: 503 },
    );
  }

  const to = Math.floor(Date.now() / 1000);
  const rangeInDays = RANGE_DAYS[resolvedRange];
  const from = to - rangeInDays * 24 * 60 * 60;

  const variants = candleSymbolVariants(symbol);

  for (const sym of variants) {
    const data = await fetchCandlesForSymbol(sym, from, to, apiKey);
    if (data === null) {
      if (DEBUG_HISTORY) {
        console.log(`[history debug] fetch failed for symbol=${sym}`);
      }
      continue;
    }

    const status = data.s;
    const cLen = Array.isArray(data.c) ? data.c.length : 0;
    const tLen = Array.isArray(data.t) ? data.t.length : 0;

    if (DEBUG_HISTORY) {
      console.log(
        `[history debug] symbol=${sym} s=${status} c.length=${cLen} t.length=${tLen}`,
      );
    }

    if (status !== "ok") {
      if (DEBUG_HISTORY) {
        console.log(
          `[history debug] non-ok candle status for ${sym}:`,
          status ?? "(missing)",
        );
      }
      continue;
    }

    if (!Array.isArray(data.c) || data.c.length === 0) {
      if (DEBUG_HISTORY) {
        console.log(`[history debug] empty c[] for ${sym}, skipping`);
      }
      continue;
    }

    if (!Array.isArray(data.t) || data.t.length === 0) {
      continue;
    }

    const points = mapCandlesToPoints(data);
    if (points.length > 0) {
      return NextResponse.json(points);
    }
  }

  return NextResponse.json([] satisfies HistoryPoint[]);
}
