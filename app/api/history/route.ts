import { NextRequest, NextResponse } from "next/server";
import type { HistoryPoint, HistoryRange } from "@/lib/history-types";

export const dynamic = "force-dynamic";

const FINNHUB_CANDLE = "https://finnhub.io/api/v1/stock/candle";

const RANGE_DAYS: Record<HistoryRange, number> = {
  "1m": 31,
  "3m": 92,
  "1y": 365,
};

const VALID_RANGES = new Set<string>(["1m", "3m", "1y"]);

type FinnhubCandles = {
  s?: string;
  c?: number[];
  t?: number[];
};

function formatDateFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  const rangeParam = request.nextUrl.searchParams.get("range")?.trim() ?? "1m";

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400 },
    );
  }

  const range = (VALID_RANGES.has(rangeParam) ? rangeParam : "1m") as HistoryRange;

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "History is not configured" },
      { status: 503 },
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - RANGE_DAYS[range] * 24 * 60 * 60;

  const url = new URL(FINNHUB_CANDLE);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", "D");
  url.searchParams.set("from", String(fromSec));
  url.searchParams.set("to", String(nowSec));
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
        date: formatDateFromUnix(ts),
        price,
      });
    }

    return NextResponse.json(out);
  } catch {
    return NextResponse.json([] satisfies HistoryPoint[]);
  }
}
