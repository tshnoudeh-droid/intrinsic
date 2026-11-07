import { unstable_cache } from "next/cache";
import YahooFinance from "yahoo-finance2";
import { ETF_CATALOG, ETF_CATEGORY_LABELS } from "@/lib/etf-catalog";
import type { ScreenerEtfRow } from "@/lib/screener-types";

/**
 * Live ETF numbers for the screener's ETF section — one batched
 * yahoo-finance2 `quote()` call for the whole catalog.
 *
 * Fields verified against live responses (VTI, VOO, XEQT.TO, ZAG.TO, SCHD…).
 * NOTE: unlike quoteSummary, these quote fields are in PERCENT units:
 * - regularMarketPrice, currency, longName / shortName
 * - netExpenseRatio: 0.03 means 0.03%
 * - dividendYield: 1.06 means 1.06%
 * - ytdReturn: 11.77 means 11.77%
 * - netAssets: fund assets in trading currency (often missing)
 * They are converted to decimals here so the UI formats them like every
 * other fraction (lib/screener-format.ts).
 */

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const REVALIDATE_SECONDS = 60 * 15;

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function pctToDecimal(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : n / 100;
}

async function fetchEtfRows(): Promise<ScreenerEtfRow[]> {
  const symbols = ETF_CATALOG.map((e) => e.symbol);
  const raw: unknown = await yahooFinance.quote(
    symbols,
    {},
    { validateResult: false },
  );
  const list = Array.isArray(raw) ? raw : [];
  const bySymbol = new Map<string, Record<string, unknown>>();
  for (const item of list) {
    const q = rec(item);
    const symbol = str(q?.symbol);
    if (q && symbol) bySymbol.set(symbol, q);
  }
  if (bySymbol.size === 0) throw new Error("Yahoo returned no ETF quotes");

  const rows: ScreenerEtfRow[] = [];
  for (const entry of ETF_CATALOG) {
    const q = bySymbol.get(entry.symbol);
    if (!q) continue; // Missing from Yahoo today — just skip it.
    rows.push({
      symbol: entry.symbol,
      name: str(q.longName) ?? str(q.shortName) ?? entry.symbol,
      category: entry.category,
      categoryLabel: ETF_CATEGORY_LABELS[entry.category],
      currency: str(q.currency),
      price: num(q.regularMarketPrice),
      expenseRatio: pctToDecimal(q.netExpenseRatio),
      dividendYield: pctToDecimal(q.dividendYield),
      ytdReturn: pctToDecimal(q.ytdReturn),
      netAssets: num(q.netAssets),
    });
  }
  return rows;
}

// Thrown errors aren't cached, so a Yahoo hiccup retries on the next request.
export const getEtfRows = unstable_cache(fetchEtfRows, ["screener-etfs-v1"], {
  revalidate: REVALIDATE_SECONDS,
});
