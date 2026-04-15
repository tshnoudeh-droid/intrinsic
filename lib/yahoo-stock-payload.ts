import YahooFinance from "yahoo-finance2";

import type {
  GrowthSource,
  UnavailableReason,
} from "@/lib/stock-detail-types";

const yahooFinance = new YahooFinance();

const DISCOUNT_RATE = 0.06;
const TERMINAL_GROWTH_RATE = 0.025;
const PROJECTION_YEARS = 5;
const DEFAULT_GROWTH = 0.05;

function safeFinite(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function num(x: unknown): number | null {
  return safeFinite(x) ? x : null;
}

/** Yahoo sometimes returns growth as decimal (0.12) or percent (12). */
function asGrowthDecimal(v: unknown): number | null {
  const x = num(v);
  if (x === null) return null;
  if (x >= -1 && x <= 1) return x;
  if (Math.abs(x) <= 100) return x / 100;
  return null;
}

function fcfFromCashflowRow(row: Record<string, unknown>): number | null {
  const ocf = num(row.totalCashFromOperatingActivities);
  const capexRaw = row.capitalExpenditures ?? row.capitalExpenditure;
  const capex = num(capexRaw);
  if (ocf === null || capex === null) return null;
  return ocf - Math.abs(capex);
}

/**
 * YoY revenue change from two annual figures (can be negative). No clamp here.
 */
function computeRevenueCagrRaw(
  newer: number | undefined,
  older: number | undefined,
): number | null {
  if (!safeFinite(newer) || !safeFinite(older) || older <= 0 || newer <= 0) {
    return null;
  }
  const raw = newer / older - 1;
  if (!Number.isFinite(raw)) return null;
  return raw;
}

/**
 * PRIMARY: Yahoo `financialData.revenueGrowth` (analyst consensus forward revenue growth).
 * SECONDARY: 2-year revenue YoY (existing helper), capped at 10% for fallback.
 * DEFAULT: 5%.
 */
function computeGrowthRateAndSource(
  revenueGrowthRaw: unknown,
  revenueCagrRaw: number | null,
  fcfPositive: boolean,
): { growthRateUsed: number; growthSource: GrowthSource } {
  const analyst = asGrowthDecimal(revenueGrowthRaw);
  if (analyst !== null && analyst >= 0 && analyst <= 0.3) {
    return { growthRateUsed: analyst, growthSource: "analyst" };
  }

  if (revenueCagrRaw !== null && Number.isFinite(revenueCagrRaw)) {
    let rate: number;
    if (revenueCagrRaw < 0) {
      rate = fcfPositive ? 0.02 : 0.0;
    } else {
      rate = Math.min(revenueCagrRaw, 0.1);
    }
    return { growthRateUsed: rate, growthSource: "historical" };
  }

  return {
    growthRateUsed: DEFAULT_GROWTH,
    growthSource: "default",
  };
}

function firstFiniteNum(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    const n = num(c);
    if (n !== null) return n;
  }
  return null;
}

function runTwoStageDcf(
  baseCashFlow: number,
  growthRate: number,
  sharesOutstanding: number,
): number | null {
  if (
    !Number.isFinite(baseCashFlow) ||
    baseCashFlow <= 0 ||
    !Number.isFinite(sharesOutstanding) ||
    sharesOutstanding <= 0
  ) {
    return null;
  }

  const g = growthRate;
  const r = DISCOUNT_RATE;
  const tg = TERMINAL_GROWTH_RATE;
  const n = PROJECTION_YEARS;

  if (r <= tg) return null;

  let sumPv = 0;
  for (let year = 1; year <= n; year++) {
    const cfYear = baseCashFlow * (1 + g) ** year;
    const pv = cfYear / (1 + r) ** year;
    if (!Number.isFinite(pv)) return null;
    sumPv += pv;
  }

  const lastCf = baseCashFlow * (1 + g) ** n;
  const terminalValue = (lastCf * (1 + tg)) / (r - tg);
  const pvTerminal = terminalValue / (1 + r) ** n;

  if (!Number.isFinite(pvTerminal)) return null;

  const total = sumPv + pvTerminal;
  const intrinsic = total / sharesOutstanding;
  return Number.isFinite(intrinsic) ? intrinsic : null;
}

export type YahooStockPayload = {
  symbol: string;
  name: string;
  price: number;
  intrinsicValue: number | null;
  marginOfSafety: number | null;
  growthRateUsed: number;
  growthSource: GrowthSource;
  discountRateUsed: number;
  cashFlowUsed: number | null;
  sharesOutstanding: number | null;
  fcf: number | null;
  dataSource: "yahoo-finance2";
  unavailableReason: UnavailableReason | null;
  marketCap: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  revenueGrowth: number | null;
  week52High: number | null;
  week52Low: number | null;
};

/**
 * Fetches Yahoo quote + summary and runs the same DCF path as /api/stock.
 * Returns null if data cannot be loaded (mirrors route failure cases).
 */
export async function computeStockPayloadFromYahoo(
  symbol: string,
): Promise<YahooStockPayload | null> {
  try {
    const [summary, quoteRaw] = await Promise.all([
      yahooFinance.quoteSummary(symbol, {
        modules: [
          "financialData",
          "defaultKeyStatistics",
          "incomeStatementHistory",
          "cashflowStatementHistory",
          "summaryDetail",
        ],
      }),
      yahooFinance.quote(symbol),
    ]);

    const quote = Array.isArray(quoteRaw) ? quoteRaw[0] : quoteRaw;
    if (!quote || typeof quote !== "object") {
      return null;
    }

    const fd = summary.financialData;
    const dks = summary.defaultKeyStatistics;
    const sd = summary.summaryDetail;
    const inc = summary.incomeStatementHistory?.incomeStatementHistory;
    const cfHist = summary.cashflowStatementHistory?.cashflowStatements;

    const price =
      num(fd?.currentPrice) ??
      num((quote as { regularMarketPrice?: number }).regularMarketPrice);

    if (price === null || price <= 0) {
      return null;
    }

    const name = String((quote as { shortName?: string }).shortName ?? symbol);

    const sharesOutstanding = num(dks?.sharesOutstanding);
    const forwardEps = num(dks?.forwardEps);
    const freeCashflowAnnual = num(fd?.freeCashflow);

    const fcfByYear: number[] = [];
    if (Array.isArray(cfHist) && cfHist.length > 0) {
      const sortedCf = [...cfHist].sort(
        (a, b) =>
          new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
      );
      for (const stmt of sortedCf.slice(0, 2)) {
        const f = fcfFromCashflowRow(stmt as unknown as Record<string, unknown>);
        if (f !== null && Number.isFinite(f)) {
          fcfByYear.push(f);
        }
      }
    }

    let averagedFcf: number | null = null;
    if (fcfByYear.length > 0) {
      averagedFcf =
        fcfByYear.reduce((a, b) => a + b, 0) / fcfByYear.length;
      if (!Number.isFinite(averagedFcf)) averagedFcf = null;
    }

    const fcfPositiveForGrowth =
      (averagedFcf !== null && averagedFcf > 0) ||
      (freeCashflowAnnual !== null && freeCashflowAnnual > 0);

    let revenueCagrRaw: number | null = null;
    if (Array.isArray(inc) && inc.length >= 2) {
      const sorted = [...inc].sort(
        (a, b) =>
          new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
      );
      revenueCagrRaw = computeRevenueCagrRaw(
        sorted[0]?.totalRevenue,
        sorted[1]?.totalRevenue,
      );
    }

    const { growthRateUsed, growthSource } = computeGrowthRateAndSource(
      fd?.revenueGrowth,
      revenueCagrRaw,
      fcfPositiveForGrowth,
    );

    let cashFlow: number | null = null;
    let fcfReported: number | null = averagedFcf;

    if (averagedFcf !== null && averagedFcf > 0) {
      cashFlow = averagedFcf;
    } else if (freeCashflowAnnual !== null && freeCashflowAnnual > 0) {
      cashFlow = freeCashflowAnnual;
      fcfReported = freeCashflowAnnual;
    } else if (
      forwardEps !== null &&
      forwardEps > 0 &&
      sharesOutstanding !== null &&
      sharesOutstanding > 0
    ) {
      cashFlow = forwardEps * sharesOutstanding;
      fcfReported = null;
    }

    let intrinsicValue: number | null = null;
    let marginOfSafety: number | null = null;

    if (
      cashFlow !== null &&
      cashFlow > 0 &&
      sharesOutstanding !== null &&
      sharesOutstanding > 0
    ) {
      intrinsicValue = runTwoStageDcf(
        cashFlow,
        growthRateUsed,
        sharesOutstanding,
      );
      if (
        intrinsicValue !== null &&
        Number.isFinite(intrinsicValue) &&
        price > 0
      ) {
        marginOfSafety = ((intrinsicValue - price) / price) * 100;
        if (!Number.isFinite(marginOfSafety)) marginOfSafety = null;
      }
    }

    let diagnosticEarnings: number | null = null;
    if (Array.isArray(inc) && inc.length > 0) {
      const sortedInc = [...inc].sort(
        (a, b) =>
          new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
      );
      const latest = sortedInc[0] as unknown as Record<string, unknown>;
      diagnosticEarnings = num(latest.netIncome);
    }
    if (
      diagnosticEarnings === null &&
      sharesOutstanding !== null &&
      sharesOutstanding > 0
    ) {
      const te = num(dks?.trailingEps);
      if (te !== null) {
        diagnosticEarnings = te * sharesOutstanding;
      }
    }

    const diagnosticCashFlow: number | null =
      averagedFcf ?? freeCashflowAnnual;

    let unavailableReason: UnavailableReason | null = null;
    if (intrinsicValue === null) {
      const so = sharesOutstanding;
      if (diagnosticCashFlow === null && diagnosticEarnings === null) {
        unavailableReason = "no_cash_flow_data";
      } else if (
        diagnosticCashFlow !== null &&
        diagnosticEarnings !== null &&
        diagnosticCashFlow <= 0 &&
        diagnosticEarnings <= 0
      ) {
        unavailableReason = "negative_cash_flow";
      } else if (so === null || so <= 0) {
        unavailableReason = "no_shares_data";
      } else {
        unavailableReason = "insufficient_data";
      }
    }

    const quoteRecord = quote as Record<string, unknown>;
    const marketCap = firstFiniteNum(
      sd?.marketCap,
      dks?.marketCap,
      quoteRecord.marketCap,
    );
    const peRatio = firstFiniteNum(sd?.trailingPE, dks?.trailingPE);
    const forwardPE = firstFiniteNum(sd?.forwardPE, dks?.forwardPE);
    const revenueGrowth = asGrowthDecimal(fd?.revenueGrowth);
    const week52High = firstFiniteNum(
      sd?.fiftyTwoWeekHigh,
      dks?.fiftyTwoWeekHigh,
    );
    const week52Low = firstFiniteNum(
      sd?.fiftyTwoWeekLow,
      dks?.fiftyTwoWeekLow,
    );

    return {
      symbol,
      name,
      price,
      intrinsicValue,
      marginOfSafety,
      growthRateUsed,
      growthSource,
      discountRateUsed: DISCOUNT_RATE,
      cashFlowUsed: cashFlow,
      sharesOutstanding:
        sharesOutstanding !== null && Number.isFinite(sharesOutstanding)
          ? sharesOutstanding
          : null,
      fcf: fcfReported,
      dataSource: "yahoo-finance2",
      unavailableReason,
      marketCap,
      peRatio,
      forwardPE,
      revenueGrowth,
      week52High,
      week52Low,
    };
  } catch {
    return null;
  }
}
