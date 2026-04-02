import { NextRequest, NextResponse } from "next/server";
import { shouldExcludeFinnhubInstrumentType } from "@/lib/finnhub-instrument-filter";
import type { StockSearchResult } from "@/lib/search-types";

export const dynamic = "force-dynamic";

const FINNHUB_SEARCH_URL = "https://finnhub.io/api/v1/search";

type FinnhubSearchItem = {
  description?: string;
  displaySymbol?: string;
  symbol?: string;
  type?: string;
};

type FinnhubSearchResponse = {
  count?: number;
  result?: FinnhubSearchItem[];
};

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
      if (shouldExcludeFinnhubInstrumentType(item.type)) continue;
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
