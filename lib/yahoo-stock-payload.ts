import YahooFinance from "yahoo-finance2";

import type {
  CashFlowSource,
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

/** Yahoo: shares outstanding is actual count; repair obvious scale errors. */
function normalizeSharesOutstanding(raw: number | null): number | null {
  if (raw === null || !Number.isFinite(raw) || raw <= 0) return null;
  let s = raw;
  if (s < 100_000) s *= 1_000_000;
  if (s > 500_000_000_000) s /= 1_000_000;
  return s;
}

/** Align FCF scale with market cap when Yahoo mixes units. */
function normalizeFcfAgainstMarketCap(
  fcf: number,
  marketCap: number | null,
): number {
  if (!Number.isFinite(fcf)) return fcf;
  if (marketCap === null || !Number.isFinite(marketCap) || marketCap <= 0) {
    return fcf;
  }
  const y = fcf / marketCap;
  if (y > 0.5) return fcf / 1_000_000;
  if (y > 0.25 && y <= 0.5) return fcf / 10;
  if (y < 0.0001) return fcf * 1_000_000;
  return fcf;
}

/** Primary: +5y earnings estimate growth; fallback: +1y. */
function earningsGrowthFrom5yOr1y(earningsTrend: unknown): number | null {
  if (!earningsTrend || typeof earningsTrend !== "object") return null;
  const trend = (earningsTrend as { trend?: unknown }).trend;
  if (!Array.isArray(trend)) return null;
  for (const period of ["+5y", "+1y"] as const) {
    const row = trend.find(
      (t) =>
        t &&
        typeof t === "object" &&
        (t as { period?: string }).period === period,
    );
    if (row && typeof row === "object") {
      const eg = asGrowthDecimal(
        (row as { earningsEstimate?: { growth?: unknown } }).earningsEstimate
          ?.growth,
      );
      if (eg !== null && eg >= 0) return eg;
    }
  }
  return null;
}

function computeGrowthRateAndSource(
  earningsTrend: unknown,
  revenueGrowthRaw: unknown,
  revenueCagrRaw: number | null,
  fcfPositive: boolean,
): { growthRateUsed: number; growthSource: GrowthSource } {
  const fromEstimates = earningsGrowthFrom5yOr1y(earningsTrend);
  if (fromEstimates !== null) {
    return {
      growthRateUsed: Math.min(fromEstimates, 0.3),
      growthSource: "analyst",
    };
  }

  const analystB = asGrowthDecimal(revenueGrowthRaw);
  if (analystB !== null && analystB >= 0) {
    return {
      growthRateUsed: Math.min(analystB, 0.3),
      growthSource: "analyst",
    };
  }

  if (revenueCagrRaw !== null && Number.isFinite(revenueCagrRaw)) {
    let rate: number;
    if (revenueCagrRaw < 0) {
      rate = fcfPositive ? 0.02 : 0.0;
    } else {
      rate = Math.min(revenueCagrRaw, 0.1);
    }
    return {
      growthRateUsed: rate,
      growthSource: "historical",
    };
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
): { perShare: number; totalPresentValue: number } | null {
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

  if (r - tg < 0.01) return null;

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

  const totalPresentValue = sumPv + pvTerminal;
  const perShare = totalPresentValue / sharesOutstanding;
  if (!Number.isFinite(perShare)) return null;
  return { perShare, totalPresentValue };
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
  cashFlowSource: CashFlowSource | null;
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
  regularMarketTime: number | null;
};

function statementRowsMissingCapex(
  cfHist: unknown,
): boolean {
  if (!Array.isArray(cfHist) || cfHist.length === 0) return true;
  const sorted = [...cfHist].sort(
    (a, b) =>
      new Date((b as { endDate: Date }).endDate).getTime() -
      new Date((a as { endDate: Date }).endDate).getTime(),
  );
  const latest = sorted[0] as unknown as Record<string, unknown>;
  const capexRaw = latest.capitalExpenditures ?? latest.capitalExpenditure;
  return num(capexRaw) === null;
}

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
          "earningsTrend",
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
    const earningsTrend = summary.earningsTrend;

    const price =
      num(fd?.currentPrice) ??
      num((quote as { regularMarketPrice?: number }).regularMarketPrice);

    if (price === null || price <= 0) {
      return null;
    }

    const name = String((quote as { shortName?: string }).shortName ?? symbol);

    const quoteRecord = quote as Record<string, unknown>;
    const marketCap = firstFiniteNum(
      sd?.marketCap,
      dks?.marketCap,
      quoteRecord.marketCap,
    );

    const sharesOutstanding = normalizeSharesOutstanding(
      num(dks?.sharesOutstanding),
    );

    const freeCashflowAnnualRaw = num(fd?.freeCashflow);
    const operatingCashflowFd = num(fd?.operatingCashflow);

    const fcfByYear: number[] = [];
    if (Array.isArray(cfHist) && cfHist.length > 0) {
      const sortedCf = [...cfHist].sort(
        (a, b) =>
          new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
      );
      for (const stmt of sortedCf.slice(0, 2)) {
        const f = fcfFromCashflowRow(stmt as unknown as Record<string, unknown>);
        if (f !== null && Number.isFinite(f) && f > 0) {
          fcfByYear.push(f);
        }
      }
    }

    let averagedFcfRaw: number | null = null;
    if (fcfByYear.length > 0) {
      averagedFcfRaw =
        fcfByYear.reduce((a, b) => a + b, 0) / fcfByYear.length;
      if (!Number.isFinite(averagedFcfRaw)) averagedFcfRaw = null;
    }

    const averagedFcfForModel =
      averagedFcfRaw !== null && averagedFcfRaw > 0
        ? normalizeFcfAgainstMarketCap(averagedFcfRaw, marketCap)
        : null;

    const freeCashflowForModel =
      freeCashflowAnnualRaw !== null && freeCashflowAnnualRaw > 0
        ? normalizeFcfAgainstMarketCap(freeCashflowAnnualRaw, marketCap)
        : null;

    const operatingOnlyCandidate =
      operatingCashflowFd !== null &&
      operatingCashflowFd > 0 &&
      statementRowsMissingCapex(cfHist)
        ? normalizeFcfAgainstMarketCap(operatingCashflowFd, marketCap)
        : null;

    const fcfPositiveForGrowth =
      (averagedFcfRaw !== null && averagedFcfRaw > 0) ||
      (freeCashflowAnnualRaw !== null && freeCashflowAnnualRaw > 0) ||
      (operatingCashflowFd !== null && operatingCashflowFd > 0);

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
      earningsTrend,
      fd?.revenueGrowth,
      revenueCagrRaw,
      fcfPositiveForGrowth,
    );

    let cashFlow: number | null = null;
    let cashFlowSource: CashFlowSource | null = null;
    let fcfReported: number | null = null;

    if (freeCashflowForModel !== null && freeCashflowForModel > 0) {
      cashFlow = freeCashflowForModel;
      cashFlowSource = "freeCashflow";
      fcfReported = freeCashflowForModel;
    } else if (averagedFcfForModel !== null && averagedFcfForModel > 0) {
      cashFlow = averagedFcfForModel;
      cashFlowSource = "computed";
      fcfReported = averagedFcfForModel;
    } else if (
      operatingOnlyCandidate !== null &&
      operatingOnlyCandidate > 0
    ) {
      cashFlow = operatingOnlyCandidate;
      cashFlowSource = "operatingOnly";
      fcfReported = null;
    } else if (
      sharesOutstanding !== null &&
      sharesOutstanding > 0
    ) {
      const trailingEps = num(dks?.trailingEps);
      if (trailingEps !== null && trailingEps > 0) {
        cashFlow = trailingEps * sharesOutstanding;
        cashFlowSource = "earnings";
        fcfReported = null;
      }
    }

    let intrinsicValue: number | null = null;
    let marginOfSafety: number | null = null;
    let unavailableReason: UnavailableReason | null = null;

    if (
      cashFlow !== null &&
      cashFlow > 0 &&
      sharesOutstanding !== null &&
      sharesOutstanding > 0
    ) {
      const dcf = runTwoStageDcf(
        cashFlow,
        growthRateUsed,
        sharesOutstanding,
      );
      if (dcf !== null) {
        intrinsicValue = dcf.perShare;
      } else if (DISCOUNT_RATE - TERMINAL_GROWTH_RATE < 0.01) {
        unavailableReason = "terminal_rate_too_close";
      } else {
        unavailableReason = "insufficient_data";
      }
      if (
        intrinsicValue !== null &&
        Number.isFinite(intrinsicValue) &&
        price > 0
      ) {
        marginOfSafety = ((intrinsicValue - price) / price) * 100;
        if (!Number.isFinite(marginOfSafety)) marginOfSafety = null;
      }
    }

    if (intrinsicValue !== null && price > 0 && intrinsicValue > price * 25) {
      intrinsicValue = null;
      marginOfSafety = null;
      unavailableReason = "calculation_error";
    }

    const trailingPE = num(sd?.trailingPE);
    const trailingEpsForPe = firstFiniteNum(
      sd?.trailingEps,
      dks?.trailingEps,
    );
    if (
      intrinsicValue !== null &&
      trailingPE !== null &&
      trailingPE >= 5 &&
      trailingPE <= 200 &&
      trailingEpsForPe !== null &&
      Number.isFinite(trailingEpsForPe)
    ) {
      const peImpliedValue = trailingEpsForPe * trailingPE * 0.8;
      if (intrinsicValue > peImpliedValue * 5) {
        intrinsicValue = null;
        marginOfSafety = null;
        unavailableReason = "calculation_error";
      }
    }

    if (intrinsicValue !== null && intrinsicValue < 0) {
      intrinsicValue = null;
      marginOfSafety = null;
      unavailableReason = "negative_result";
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
      averagedFcfRaw ?? freeCashflowAnnualRaw;

    if (intrinsicValue === null && unavailableReason === null) {
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

    const rmt = (quote as { regularMarketTime?: unknown }).regularMarketTime;
    const regularMarketTimeRaw =
      rmt instanceof Date
        ? Math.floor(rmt.getTime() / 1000)
        : num(rmt);

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
      cashFlowSource,
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
      regularMarketTime: regularMarketTimeRaw,
    };
  } catch {
    return null;
  }
}
