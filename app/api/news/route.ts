import { NextRequest, NextResponse } from "next/server";
import { CACHE_HEADERS_NO_STORE } from "@/lib/http-cache-headers";
import { normalizeSymbol } from "@/lib/symbol-normalize";
import { fetchStockNews } from "@/lib/stock-news";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawSymbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  if (!rawSymbol) {
    return NextResponse.json(
      { error: true, message: "Symbol is required" },
      { status: 400, headers: CACHE_HEADERS_NO_STORE },
    );
  }

  const symbol = normalizeSymbol(rawSymbol);
  const news = await fetchStockNews(symbol);

  return NextResponse.json({ news }, { headers: CACHE_HEADERS_NO_STORE });
}
