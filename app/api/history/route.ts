import { NextRequest, NextResponse } from "next/server";
import type { HistoryPoint, HistoryRange } from "@/lib/history-types";
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

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  const rawRange = request.nextUrl.searchParams.get("range");

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400 },
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
      { status: 400 },
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
      return NextResponse.json([] satisfies HistoryPoint[]);
    }

    const chartData: HistoryPoint[] = [];
    for (const row of results) {
      if (!row || typeof row !== "object") continue;
      const close = (row as { close?: unknown }).close;
      const d = (row as { date?: Date }).date;
      if (close === null || close === undefined) continue;
      const price = Number(close);
      if (!Number.isFinite(price)) continue;
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
      chartData.push({
        date: d.toLocaleDateString("en-CA", {
          month: "short",
          day: "numeric",
        }),
        price,
      });
    }

    return NextResponse.json(chartData);
  } catch {
    return NextResponse.json([] satisfies HistoryPoint[]);
  }
}
