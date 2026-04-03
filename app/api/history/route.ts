import { NextRequest, NextResponse } from "next/server";
import type { HistoryPoint } from "@/lib/history-types";

export const dynamic = "force-dynamic";

const FINNHUB_CANDLE = "https://finnhub.io/api/v1/stock/candle";

/** DEBUG MODE: force test symbol — remove after chart verified */
const DEBUG_SYMBOL = "AAPL";

type FinnhubCandles = {
  s?: string;
  c?: number[];
  t?: number[];
};

export async function GET(request: NextRequest) {
  void request;
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "History is not configured" },
      { status: 503 },
    );
  }

  // TEMP: always last 90 days (range buttons disabled on frontend)
  const symbol = DEBUG_SYMBOL;
  const to = Math.floor(Date.now() / 1000);
  const from = to - 90 * 24 * 60 * 60;

  console.log("SYMBOL:", symbol);
  console.log("FROM:", from);
  console.log("TO:", to);

  const url = new URL(FINNHUB_CANDLE);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", "D");
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));
  url.searchParams.set("token", apiKey);

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch (e) {
    console.log("FINNHUB FETCH ERROR:", e);
    return NextResponse.json([] satisfies HistoryPoint[]);
  }

  if (!res.ok) {
    console.log("FINNHUB HTTP NOT OK:", res.status);
    return NextResponse.json([] satisfies HistoryPoint[]);
  }

  let data: FinnhubCandles;
  try {
    data = (await res.json()) as FinnhubCandles;
  } catch {
    return NextResponse.json([] satisfies HistoryPoint[]);
  }

  console.log("FINNHUB RESPONSE:", data);

  if (data.s !== "ok") {
    console.log("NO DATA FROM FINNHUB", data);
    return NextResponse.json([] satisfies HistoryPoint[]);
  }

  if (!Array.isArray(data.c) || !Array.isArray(data.t)) {
    return NextResponse.json([] satisfies HistoryPoint[]);
  }

  const c = data.c;
  const t = data.t;
  const chartData = t.map((time, i) => ({
    date: new Date(time * 1000).toLocaleDateString(),
    price: c[i],
  }));

  console.log("CHART DATA LENGTH:", chartData.length);

  return NextResponse.json(chartData);
}
