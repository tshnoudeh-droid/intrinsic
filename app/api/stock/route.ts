import { NextRequest, NextResponse } from "next/server";
import type { StockDetailPayload } from "@/lib/stock-detail-types";

export const dynamic = "force-dynamic";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

type FinnhubQuote = {
  c?: number;
  pc?: number;
};

type FinnhubProfile2 = {
  name?: string;
  ticker?: string;
};

function finnhubUrl(path: string, symbol: string, token: string): string {
  const url = new URL(`${FINNHUB_BASE}${path}`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("token", token);
  return url.toString();
}

function parsePrice(quote: FinnhubQuote): number | null {
  const c = quote.c;
  const pc = quote.pc;
  const raw = c ?? pc;
  if (raw === undefined || raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400 },
    );
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Stock data is not configured" },
      { status: 503 },
    );
  }

  try {
    const [quoteRes, profileRes] = await Promise.all([
      fetch(finnhubUrl("/quote", symbol, apiKey), { cache: "no-store" }),
      fetch(finnhubUrl("/stock/profile2", symbol, apiKey), { cache: "no-store" }),
    ]);

    if (!quoteRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch quote" },
        { status: quoteRes.status >= 500 ? 502 : quoteRes.status },
      );
    }

    const quote = (await quoteRes.json()) as FinnhubQuote;
    const price = parsePrice(quote);
    if (price === null) {
      return NextResponse.json(
        { error: "No price data available for this symbol" },
        { status: 404 },
      );
    }

    let name = symbol;
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as FinnhubProfile2;
      const n = profile.name?.trim();
      if (n) name = n;
    }

    const payload: StockDetailPayload = {
      symbol,
      name,
      price,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to load stock data" },
      { status: 502 },
    );
  }
}
