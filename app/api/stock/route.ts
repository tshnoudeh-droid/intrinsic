import { NextRequest, NextResponse } from "next/server";
import { CACHE_HEADERS_NO_STORE } from "@/lib/http-cache-headers";
import { normalizeSymbol } from "@/lib/symbol-normalize";
import { computeStockPayloadFromYahoo } from "@/lib/yahoo-stock-payload";

export const dynamic = "force-dynamic";

const REGULATED_CANADIAN_STOCKS_RAW = [
  "BCE",
  "T",
  "RCI",
  "RCI.B",
  "RCI-B",
  "TU",
  "QBR",
  "MBT",
  "EMP",
] as const;

const REGULATED_CANADIAN_SYMBOLS = new Set(
  REGULATED_CANADIAN_STOCKS_RAW.map((s) => normalizeSymbol(s)),
);

const REGULATORY_NOTE =
  "This is a regulated Canadian company. High debt loads and government policy on competition may limit future growth beyond what this model assumes. The DCF may overstate intrinsic value if growth slows further.";

export async function GET(request: NextRequest) {
  const rawSymbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  if (!rawSymbol) {
    return NextResponse.json(
      { error: true, message: "Symbol is required" },
      { status: 400, headers: CACHE_HEADERS_NO_STORE },
    );
  }

  const symbol = normalizeSymbol(rawSymbol);

  // DCF, unit normalization (shares + FCF vs market cap), growth selection, and
  // intrinsic sanity checks live in `computeStockPayloadFromYahoo` (server logs:
  // UNITS CHECK, GROWTH RATE, SANITY CHECK FAILED).
  const payload = await computeStockPayloadFromYahoo(symbol);
  if (!payload) {
    return NextResponse.json(
      { error: true, message: "Failed to load data" },
      { status: 502, headers: CACHE_HEADERS_NO_STORE },
    );
  }

  const regulatoryNote = REGULATED_CANADIAN_SYMBOLS.has(symbol)
    ? REGULATORY_NOTE
    : null;

  return NextResponse.json(
    { ...payload, regulatoryNote },
    { headers: CACHE_HEADERS_NO_STORE },
  );
}
