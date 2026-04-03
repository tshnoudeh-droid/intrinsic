import { NextRequest, NextResponse } from "next/server";
import { calculateIntrinsicValue } from "@/lib/calculate-intrinsic-value";
import {
  computeFcfFromOperatingAndCapEx,
  extractNetIncomeFromFinancialsReported,
  extractOperatingCashFlowAndCapExFromReported,
  parseFinnhubNumber,
  resolveSharesOutstanding,
} from "@/lib/finnhub-financial-extract";
import type { StockDetailPayload } from "@/lib/stock-detail-types";
import {
  isValidMarketPrice,
  sanitizeCashFlowForValuation,
  sanitizeSharesOutstanding,
} from "@/lib/stock-validation";

export const dynamic = "force-dynamic";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

type FinnhubQuote = {
  c?: number;
  pc?: number;
};

type FinnhubProfile2 = {
  name?: string;
  ticker?: string;
  shareOutstanding?: number;
  marketCapitalization?: number;
};

function finnhubUrl(path: string, symbol: string, token: string): string {
  const url = new URL(`${FINNHUB_BASE}${path}`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("token", token);
  return url.toString();
}

function finnhubMetricAllUrl(symbol: string, token: string): string {
  const url = new URL(`${FINNHUB_BASE}/stock/metric`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("metric", "all");
  url.searchParams.set("token", token);
  return url.toString();
}

function finnhubFinancialsReportedUrl(symbol: string, token: string): string {
  const url = new URL(`${FINNHUB_BASE}/stock/financials-reported`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("freq", "annual");
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

async function safeJson(res: Response): Promise<unknown | null> {
  if (!res.ok) return null;
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function finnhubFailureResponse() {
  return NextResponse.json({ error: true }, { status: 502 });
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
    return NextResponse.json({ error: true }, { status: 503 });
  }

  try {
    const [quoteRes, profileRes, financialsRes, metricRes] = await Promise.all([
      fetch(finnhubUrl("/quote", symbol, apiKey), { cache: "no-store" }),
      fetch(finnhubUrl("/stock/profile2", symbol, apiKey), { cache: "no-store" }),
      fetch(finnhubFinancialsReportedUrl(symbol, apiKey), { cache: "no-store" }),
      fetch(finnhubMetricAllUrl(symbol, apiKey), { cache: "no-store" }),
    ]);

    if (!quoteRes.ok) {
      return finnhubFailureResponse();
    }

    let quote: FinnhubQuote;
    try {
      quote = (await quoteRes.json()) as FinnhubQuote;
    } catch {
      return finnhubFailureResponse();
    }

    const priceRaw = parsePrice(quote);
    if (!isValidMarketPrice(priceRaw)) {
      return finnhubFailureResponse();
    }
    const price = priceRaw;

    let name = symbol;
    let marketCap: number | null = null;
    if (profileRes.ok) {
      try {
        const profile = (await profileRes.json()) as FinnhubProfile2;
        const n = profile.name?.trim();
        if (n) name = n;
        marketCap = parseFinnhubNumber(profile.marketCapitalization);
      } catch {
        /* keep symbol as name */
      }
    }

    const financialsJson = await safeJson(financialsRes);
    const metricJson = await safeJson(metricRes);

    // TEMPORARY: inspect /stock/metric (set STOCK_DEBUG_FINNHUB=1 for any env)
    if (
      process.env.NODE_ENV === "development" ||
      process.env.STOCK_DEBUG_FINNHUB === "1"
    ) {
      console.log("[stock debug] financialsReported:", JSON.stringify(financialsJson));
      console.log("[stock debug] /stock/metric full response:", JSON.stringify(metricJson));
      if (metricJson && typeof metricJson === "object") {
        const m = (metricJson as { metric?: unknown }).metric;
        if (m && typeof m === "object") {
          console.log("[stock debug] metric keys:", Object.keys(m as object));
        }
      }
    }

    const { operatingCashFlow, capitalExpenditures } =
      extractOperatingCashFlowAndCapExFromReported(financialsJson);
    const fcf = computeFcfFromOperatingAndCapEx(
      operatingCashFlow,
      capitalExpenditures,
    );

    const earnings = extractNetIncomeFromFinancialsReported(financialsJson);

    const cashFlowSelected = fcf ?? earnings;
    const cashFlow = sanitizeCashFlowForValuation(cashFlowSelected);

    const sharesRaw = resolveSharesOutstanding(metricJson, marketCap, price);
    const sharesOutstanding = sanitizeSharesOutstanding(sharesRaw);

    const intrinsicValue = calculateIntrinsicValue({
      cashFlow,
      sharesOutstanding,
    });

    const payload: StockDetailPayload = {
      symbol,
      name,
      price,
      intrinsicValue,
      cashFlowUsed: cashFlow,
      sharesOutstanding,
    };

    return NextResponse.json(payload);
  } catch {
    return finnhubFailureResponse();
  }
}
