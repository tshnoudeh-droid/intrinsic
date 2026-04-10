import { NextRequest, NextResponse } from "next/server";
import { CACHE_HEADERS_NO_STORE } from "@/lib/http-cache-headers";
import { computeStockPayloadFromYahoo } from "@/lib/yahoo-stock-payload";
import { valuationLabelFromMargin } from "@/lib/valuation-label";

export const dynamic = "force-dynamic";

export type WatchlistDataItem = {
  symbol: string;
  name: string;
  price: number;
  intrinsicValue: number | null;
  marginOfSafety: number | null;
  label: "Undervalued" | "Fair" | "Overvalued" | null;
};

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("symbols")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json([] satisfies (WatchlistDataItem | null)[], {
      headers: CACHE_HEADERS_NO_STORE,
    });
  }

  const symbols = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  const results = await Promise.all(
    symbols.map(async (symbol): Promise<WatchlistDataItem | null> => {
      try {
        const p = await computeStockPayloadFromYahoo(symbol);
        if (!p) return null;
        const label =
          p.marginOfSafety !== null
            ? valuationLabelFromMargin(p.marginOfSafety)
            : null;
        return {
          symbol: p.symbol,
          name: p.name,
          price: p.price,
          intrinsicValue: p.intrinsicValue,
          marginOfSafety: p.marginOfSafety,
          label,
        };
      } catch {
        return null;
      }
    }),
  );

  return NextResponse.json(results satisfies (WatchlistDataItem | null)[], {
    headers: CACHE_HEADERS_NO_STORE,
  });
}
