import { NextRequest, NextResponse } from "next/server";
import { processWithConcurrency } from "@/lib/concurrency";
import { SCREENER_TICKERS } from "@/lib/sp500-tsx60-tickers";
import { getSupabaseServerClient } from "@/lib/supabase-client";
import { valuationLabelFromMargin } from "@/lib/valuation-label";
import { computeStockPayloadFromYahoo } from "@/lib/yahoo-stock-payload";

export const dynamic = "force-dynamic";
// 60s is the Vercel Hobby-plan ceiling for `maxDuration`; the concurrency
// batching in lib/concurrency.ts keeps the full ~560-symbol run within it.
export const maxDuration = 60;

const CONCURRENCY = 20;
// Bounds the tail latency of a single Yahoo call so one hung request can't
// stall an entire concurrency lane for the whole job.
const PER_TICKER_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json(
      { error: true, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: true, message: "Supabase not configured" },
      { status: 500 },
    );
  }

  let succeeded = 0;
  const failed: string[] = [];

  // A symbol that fails to refresh must not keep a valuation computed by an
  // older model (rows from Sept 2026 still showed e.g. WBD at 1981% margin of
  // safety). Price/market data is left as-is; only valuation fields clear.
  const clearValuation = async (symbol: string) => {
    failed.push(symbol);
    await supabase
      .from("screener_stocks")
      .update({
        intrinsic_value: null,
        margin_of_safety: null,
        valuation_label: null,
      })
      .eq("symbol", symbol);
  };

  await processWithConcurrency(SCREENER_TICKERS, CONCURRENCY, async (ticker) => {
    try {
      const payload = await withTimeout(
        computeStockPayloadFromYahoo(ticker.symbol),
        PER_TICKER_TIMEOUT_MS,
      );
      if (!payload) {
        await clearValuation(ticker.symbol);
        return;
      }

      const valuationLabel =
        payload.marginOfSafety !== null
          ? valuationLabelFromMargin(payload.marginOfSafety)
          : null;

      const { error } = await supabase.from("screener_stocks").upsert({
        symbol: payload.symbol,
        name: payload.name,
        exchange: ticker.exchange,
        price: payload.price,
        intrinsic_value: payload.intrinsicValue,
        margin_of_safety: payload.marginOfSafety,
        valuation_label: valuationLabel,
        market_cap: payload.marketCap,
        pe_ratio: payload.peRatio,
        forward_pe: payload.forwardPE,
        revenue_growth: payload.revenueGrowth,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        await clearValuation(ticker.symbol);
      } else {
        succeeded++;
      }
    } catch {
      await clearValuation(ticker.symbol).catch(() => {});
    }
  });

  return NextResponse.json({ succeeded, failed: failed.length, failedSymbols: failed });
}
