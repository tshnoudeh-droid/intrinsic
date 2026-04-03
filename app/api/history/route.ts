import { NextRequest, NextResponse } from "next/server";
import type { HistoryPoint, HistoryRange } from "@/lib/history-types";

export const dynamic = "force-dynamic";

const FINNHUB_CANDLE = "https://finnhub.io/api/v1/stock/candle";

const SECONDS_PER_DAY = 24 * 60 * 60;

/** Range window in seconds: 30 / 90 / 365 calendar days. */
const RANGE_SECONDS: Record<HistoryRange, number> = {
  "1M": 30 * SECONDS_PER_DAY,
  "3M": 90 * SECONDS_PER_DAY,
  "1Y": 365 * SECONDS_PER_DAY,
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

/** Readable label for charts, e.g. "Jan 12" (UTC, matches Finnhub candle day). */
function formatChartDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
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
  const from = to - RANGE_SECONDS[resolvedRange];

  const url = new URL(FINNHUB_CANDLE);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", "D");
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));
  url.searchParams.set("token", apiKey);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json([] satisfies HistoryPoint[]);
    }

    const data = (await res.json()) as FinnhubCandles;
    if (data.s !== "ok" || !Array.isArray(data.t) || !Array.isArray(data.c)) {
      return NextResponse.json([] satisfies HistoryPoint[]);
    }

    const out: HistoryPoint[] = [];
    const n = Math.min(data.t.length, data.c.length);
    for (let i = 0; i < n; i++) {
      const ts = data.t[i];
      const close = data.c[i];
      if (typeof ts !== "number" || typeof close !== "number") continue;
      const price = Number(close);
      if (!Number.isFinite(price)) continue;
      out.push({
        date: formatChartDate(ts),
        price,
      });
    }

    return NextResponse.json(out);
  } catch {
    return NextResponse.json([] satisfies HistoryPoint[]);
  }
}
