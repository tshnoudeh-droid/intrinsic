import { NextRequest, NextResponse } from "next/server";
import { computeStockPayloadFromYahoo } from "@/lib/yahoo-stock-payload";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  if (!symbol) {
    return NextResponse.json(
      { error: true, message: "Symbol is required" },
      { status: 400 },
    );
  }

  const payload = await computeStockPayloadFromYahoo(symbol);
  if (!payload) {
    return NextResponse.json(
      { error: true, message: "Failed to load data" },
      { status: 502 },
    );
  }

  return NextResponse.json(payload);
}
