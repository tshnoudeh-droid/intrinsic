import { NextRequest, NextResponse } from "next/server";
import { CACHE_HEADERS_NO_STORE } from "@/lib/http-cache-headers";
import { computeStockPayloadFromYahoo } from "@/lib/yahoo-stock-payload";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  if (!symbol) {
    return NextResponse.json(
      { error: true, message: "Symbol is required" },
      { status: 400, headers: CACHE_HEADERS_NO_STORE },
    );
  }

  const payload = await computeStockPayloadFromYahoo(symbol);
  if (!payload) {
    return NextResponse.json(
      { error: true, message: "Failed to load data" },
      { status: 502, headers: CACHE_HEADERS_NO_STORE },
    );
  }

  return NextResponse.json(payload, { headers: CACHE_HEADERS_NO_STORE });
}
