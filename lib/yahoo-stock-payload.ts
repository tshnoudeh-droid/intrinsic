import YahooFinance from "yahoo-finance2";
import type { QuoteSummaryResult } from "yahoo-finance2/modules/quoteSummary-iface";

import type {
  CashFlowSource,
  GrowthSource,
  UnavailableReason,
} from "@/lib/stock-detail-types";
import {
  calculateDCF,
  MAX_DEFAULT_PROJECTION_GROWTH,
  passesIntrinsicSanityCheck,
  peImpliedReferenceValue,
} from "@/lib/calculate-dcf-client";
import { DCF_ASSUMPTIONS } from "@/lib/calculate-intrinsic-value";
import { marginOfSafetyPercent } from "@/lib/valuation-label";

const yahooFinance = new YahooFinance();

const DISCOUNT_RATE = DCF_ASSUMPTIONS.discountRate;
const TERMINAL_GROWTH_RATE = DCF_ASSUMPTIONS.terminalGrowthRate;
const DEFAULT_GROWTH = DCF_ASSUMPTIONS.growthRate;

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

/**
 * Data check: a cash flow above 25% or below 0.01% of market cap is treated
 * as an implausible figure and that tier is skipped (null), so the next
 * documented tier applies. Yahoo returns raw units, so the previous
 * "repair" (÷1e6, ÷10, ×1e6) fabricated numbers — e.g. PSKY's 17.6B FCF on
 * an 11B market cap became 17.6K, valuing it at $0.0008/share.
 */
function normalizeFcfAgainstMarketCap(
  fcf: number,
  marketCap: number | null,
): number | null {
  if (!Number.isFinite(fcf)) return null;
  if (marketCap === null || !Number.isFinite(marketCap) || marketCap <= 0) {
    return fcf;
  }
  const y = fcf / marketCap;
  if (y > 0.25 || y < 0.0001) return null;
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

function selectGrowthRateAndSource(
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

const FX_CACHE_TTL_MS = 60 * 60 * 1000;
const fxCache = new Map<string, { rate: number; at: number }>();

/**
 * Units of `quoteCurrency` per 1 unit of `financialCurrency` via Yahoo's FX
 * quote (e.g. "USDCAD=X"). 1 when currencies match; null when unknown.
 */
async function fetchFxRate(
  financialCurrency: string | null,
  quoteCurrency: string | null,
): Promise<number | null> {
  if (!financialCurrency || !quoteCurrency) return 1;
  const from = financialCurrency.toUpperCase();
  const to = quoteCurrency.toUpperCase();
  if (from === to) return 1;
  const pair = `${from}${to}=X`;
  const cached = fxCache.get(pair);
  if (cached && Date.now() - cached.at < FX_CACHE_TTL_MS) return cached.rate;
  try {
    const q = await yahooFinance.quote(pair);
    const rate = num((q as { regularMarketPrice?: unknown }).regularMarketPrice);
    if (rate === null || rate <= 0) return null;
    fxCache.set(pair, { rate, at: Date.now() });
    return rate;
  } catch {
    return null;
  }
}

/** Documented growth-source priority, then the projection growth guard. */
function computeGrowthRateAndSource(
  earningsTrend: unknown,
  revenueGrowthRaw: unknown,
  revenueCagrRaw: number | null,
  fcfPositive: boolean,
): { growthRateUsed: number; growthSource: GrowthSource } {
  const selected = selectGrowthRateAndSource(
    earningsTrend,
    revenueGrowthRaw,
    revenueCagrRaw,
    fcfPositive,
  );
  return {
    ...selected,
    growthRateUsed: Math.min(
      selected.growthRateUsed,
      MAX_DEFAULT_PROJECTION_GROWTH,
    ),
  };
}

function firstFiniteNum(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    const n = num(c);
    if (n !== null) return n;
  }
  return null;
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
  /** Reference value for the intrinsic sanity check (see calculate-dcf-client). */
  sanityReferenceValue: number;
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
    // Schema validation is disabled: Yahoo intermittently returns e.g.
    // `summaryDetail.currency: null` (BNY) or odd quote fields (WBD, PSKY),
    // which made the whole symbol fail and left stale screener rows. Every
    // field below is read through `num()` / type guards, so unvalidated data
    // degrades to "missing" instead of crashing.
    const [summaryRaw, quoteRaw] = await Promise.all([
      yahooFinance.quoteSummary(
        symbol,
        {
          modules: [
            "financialData",
            "defaultKeyStatistics",
            "incomeStatementHistory",
            "cashflowStatementHistory",
            "summaryDetail",
            "earningsTrend",
          ],
        },
        { validateResult: false },
      ),
      yahooFinance.quote(symbol, {}, { validateResult: false }),
    ]);
    if (!summaryRaw || typeof summaryRaw !== "object") return null;
    const summary = summaryRaw as QuoteSummaryResult;

    // Yahoo's quote endpoint returns nothing for some symbols (e.g. WBD,
    // PSKY) while quoteSummary still works; fall back to summary fields.
    const quoteFirst: unknown = Array.isArray(quoteRaw) ? quoteRaw[0] : quoteRaw;
    const quote: object =
      quoteFirst && typeof quoteFirst === "object" ? quoteFirst : {};

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

    // Statement / financialData figures are in `financialCurrency` (e.g. USD
    // for Shopify, Barrick, CSU on the TSX) while price, market cap and
    // trailing EPS are in the listing currency. Convert cash flows to the
    // listing currency so per-share value is comparable with price.
    const quoteCurrencyRaw =
      (quote as { currency?: unknown }).currency ??
      (sd as { currency?: unknown } | undefined)?.currency;
    const financialCurrencyRaw = (fd as { financialCurrency?: unknown } | undefined)
      ?.financialCurrency;
    const fxRate = await fetchFxRate(
      typeof financialCurrencyRaw === "string" ? financialCurrencyRaw : null,
      typeof quoteCurrencyRaw === "string" ? quoteCurrencyRaw : null,
    );
    const toQuoteCurrency = (x: number | null): number | null =>
      x === null || fxRate === null ? null : x * fxRate;

    const quoteRecord = quote as Record<string, unknown>;
    const marketCap = firstFiniteNum(
      sd?.marketCap,
      dks?.marketCap,
      quoteRecord.marketCap,
    );

    // `sharesOutstanding` is the listed share class only (e.g. BRK-B excludes
    // Class A, GOOGL excludes GOOG); `impliedSharesOutstanding` is the
    // all-class total Yahoo uses for market cap (marketCap / price), which is
    // what a whole-company cash flow must be divided by.
    const sharesOutstanding = normalizeSharesOutstanding(
      num(dks?.impliedSharesOutstanding) ?? num(dks?.sharesOutstanding),
    );

    const freeCashflowAnnualRaw = toQuoteCurrency(num(fd?.freeCashflow));
    const operatingCashflowFd = toQuoteCurrency(num(fd?.operatingCashflow));

    const fcfByYear: number[] = [];
    if (Array.isArray(cfHist) && cfHist.length > 0) {
      const sortedCf = [...cfHist].sort(
        (a, b) =>
          new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
      );
      for (const stmt of sortedCf.slice(0, 2)) {
        const f = toQuoteCurrency(
          fcfFromCashflowRow(stmt as unknown as Record<string, unknown>),
        );
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
      const dcf = calculateDCF({
        cashFlow,
        sharesOutstanding,
        growthRate: growthRateUsed,
        discountRate: DISCOUNT_RATE,
        terminalGrowthRate: TERMINAL_GROWTH_RATE,
      });
      if (dcf !== null) {
        intrinsicValue = dcf;
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
        marginOfSafety = marginOfSafetyPercent(intrinsicValue, price);
      }
    }

    // Trailing P/E sanity check, shared with the stock page's live sliders.
    const sanityReferenceValue = peImpliedReferenceValue(
      price,
      firstFiniteNum(sd?.trailingEps, dks?.trailingEps),
      num(sd?.trailingPE),
    );
    if (
      intrinsicValue !== null &&
      !passesIntrinsicSanityCheck(intrinsicValue, sanityReferenceValue)
    ) {
      intrinsicValue = null;
      marginOfSafety = null;
      unavailableReason = "calculation_error";
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
      sanityReferenceValue,
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
