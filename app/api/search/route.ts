import { NextRequest, NextResponse } from "next/server";
import type { StockSearchResult } from "@/lib/search-types";

export const dynamic = "force-dynamic";

const FINNHUB_SEARCH_URL = "https://finnhub.io/api/v1/search";

const SUPPORTED_EXCHANGES = new Set([
  "NYSE",
  "NASDAQ",
  "TSX",
  "TSXV",
  "NEO",
  "US",
  "TO",
  "V",
]);

type FinnhubSearchItem = {
  description?: string;
  displaySymbol?: string;
  symbol?: string;
  type?: string;
  exchange?: string;
};

type FinnhubSearchResponse = {
  count?: number;
  result?: FinnhubSearchItem[];
};

function dotCount(s: string): number {
  return (s.match(/\./g) ?? []).length;
}

/**
 * Finnhub search: US + Canada only, common stock, drop unsupported venues
 * and overly complex symbols (e.g. more than one dot except TSX class .TO/.V).
 */
function isSupportedSearchResult(item: FinnhubSearchItem): boolean {
  if (item.type?.trim() !== "Common Stock") return false;

  const symbolRaw = item.symbol?.trim() ?? "";
  if (!symbolRaw) return false;

  const symbol = symbolRaw.toUpperCase();
  const ex = item.exchange?.trim().toUpperCase() ?? "";

  const dots = dotCount(symbol);
  if (dots > 2) return false;
  if (dots === 2 && !/^[A-Z0-9]+\.[A-Z]\.(TO|V)$/.test(symbol)) return false;
  if (
    dots === 1 &&
    !/^[A-Z0-9]+\.[A-Z]$/.test(symbol) &&
    !/^[A-Z0-9]+\.TO$/.test(symbol) &&
    !/^[A-Z0-9]+\.V$/.test(symbol)
  ) {
    return false;
  }

  const onCanadianSuffix = symbol.endsWith(".TO") || symbol.endsWith(".V");
  const usNoDot = !symbol.includes(".");
  const exchangeOk = ex === "" || SUPPORTED_EXCHANGES.has(ex);

  if (onCanadianSuffix) {
    return exchangeOk;
  }

  if (usNoDot) {
    return exchangeOk;
  }

  if (/^[A-Z0-9]+\.[A-Z]$/.test(symbol)) {
    return exchangeOk;
  }

  return SUPPORTED_EXCHANGES.has(ex);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json([] satisfies StockSearchResult[]);
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Search is not configured" },
      { status: 503 },
    );
  }

  const url = new URL(FINNHUB_SEARCH_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("token", apiKey);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json([]);
    }

    const data = (await res.json()) as FinnhubSearchResponse;
    const raw = Array.isArray(data.result) ? data.result : [];

    const out: StockSearchResult[] = [];
    for (const item of raw) {
      if (!isSupportedSearchResult(item)) continue;
      const symbol = item.symbol?.trim();
      if (!symbol) continue;
      out.push({
        symbol,
        description: item.description?.trim() ?? "",
      });
    }

    return NextResponse.json(out);
  } catch {
    return NextResponse.json([]);
  }
}
