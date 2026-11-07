import { NextRequest, NextResponse } from "next/server";
import { getCompanyProfile } from "@/lib/company-profile";
import { processWithConcurrency } from "@/lib/concurrency";
import { CACHE_HEADERS_NO_STORE } from "@/lib/http-cache-headers";
import { SCREENER_TICKERS } from "@/lib/sp500-tsx60-tickers";

export const maxDuration = 30;

/** Per request; the client splits larger result sets into chunks. */
const MAX_SYMBOLS = 50;
const CONCURRENCY = 8;

const TRACKED = new Set(SCREENER_TICKERS.map((t) => t.symbol));

const CACHE_LONG = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
} as const;

/**
 * GET /api/screener/sectors?symbols=AAPL,MSFT → { sectors: { AAPL: "Technology", … } }
 *
 * Sector comes from Yahoo `assetProfile` via lib/company-profile.ts (cached a
 * day per symbol). `allowGenerate: false` — never calls Groq here; the
 * plain-English summary is only generated when a user opens CompanyInfoButton.
 * Only screener-tracked symbols are accepted, so this can't be used to fan
 * out arbitrary Yahoo lookups.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
  if (
    symbols.length === 0 ||
    symbols.length > MAX_SYMBOLS ||
    !symbols.every((s) => TRACKED.has(s))
  ) {
    return NextResponse.json(
      { error: true, message: "Invalid symbols" },
      { status: 400, headers: CACHE_HEADERS_NO_STORE },
    );
  }

  const sectors: Record<string, string | null> = {};
  let failures = 0;
  await processWithConcurrency(symbols, CONCURRENCY, async (symbol) => {
    try {
      const profile = await getCompanyProfile(symbol, { allowGenerate: false });
      sectors[symbol] = profile.sector;
    } catch {
      failures++;
      sectors[symbol] = null;
    }
  });

  return NextResponse.json(
    { sectors },
    { headers: failures === 0 ? CACHE_LONG : CACHE_HEADERS_NO_STORE },
  );
}
