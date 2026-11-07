import { NextResponse } from "next/server";
import { getEtfRows } from "@/lib/etf-data";
import { CACHE_HEADERS_NO_STORE } from "@/lib/http-cache-headers";

export const maxDuration = 20;

/**
 * GET /api/screener/etfs → { etfs: ScreenerEtfRow[] }
 * The whole curated catalog (~30 funds) with live Yahoo numbers; the client
 * ranks / narrows by the query's intent, so one cached response serves all.
 */
export async function GET() {
  try {
    const etfs = await getEtfRows();
    return NextResponse.json(
      { etfs },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    console.error("[screener/etfs] failed", error);
    return NextResponse.json(
      { error: true, message: "ETF data is temporarily unavailable." },
      { status: 502, headers: CACHE_HEADERS_NO_STORE },
    );
  }
}
