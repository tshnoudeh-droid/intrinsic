import { NextRequest, NextResponse } from "next/server";
import { calculateIntrinsicValue } from "@/lib/calculate-intrinsic-value";
import {
  extractFcfFromBasicFinancials,
  extractLatestAnnualFcfFromFinancialsReported,
  extractNetIncomeFromBasicFinancials,
  extractSharesOutstanding,
  parseFinnhubNumber,
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
    let sharesFromProfile: number | null = null;
    if (profileRes.ok) {
      try {
        const profile = (await profileRes.json()) as FinnhubProfile2;
        const n = profile.name?.trim();
        if (n) name = n;
        sharesFromProfile = sanitizeSharesOutstanding(
          parseFinnhubNumber(profile.shareOutstanding),
        );
      } catch {
        /* keep defaults */
      }
    }

    const financialsJson = await safeJson(financialsRes);
    const metricJson = await safeJson(metricRes);

    let fcf: number | null = null;
    try {
      fcf = extractLatestAnnualFcfFromFinancialsReported(financialsJson);
    } catch {
      fcf = null;
    }

    try {
      if (fcf === null) {
        fcf = extractFcfFromBasicFinancials(metricJson);
      }
    } catch {
      /* keep fcf */
    }

    let earnings: number | null = null;
    try {
      earnings = extractNetIncomeFromBasicFinancials(metricJson);
    } catch {
      earnings = null;
    }

    let sharesOutstanding: number | null = null;
    try {
      sharesOutstanding = sanitizeSharesOutstanding(
        extractSharesOutstanding(metricJson, sharesFromProfile),
      );
    } catch {
      sharesOutstanding = sharesFromProfile;
    }

    const cashFlow =
      sanitizeCashFlowForValuation(fcf) ??
      sanitizeCashFlowForValuation(earnings);

    const intrinsicValue = calculateIntrinsicValue({
      cashFlow,
      sharesOutstanding,
    });

    const payload: StockDetailPayload = {
      symbol,
      name,
      price,
      intrinsicValue,
    };

    return NextResponse.json(payload);
  } catch {
    return finnhubFailureResponse();
  }
}
