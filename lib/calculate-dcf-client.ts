/**
 * Shared two-stage DCF (5 projection years + Gordon terminal value) and the
 * sanity guards around it. Used by BOTH the server payload (stock API, cron
 * screener refresh, watchlist) and the stock page's live sliders, so the
 * screener and stock page always agree at default assumptions.
 */
export type CalculateDcfInput = {
  cashFlow: number | null;
  sharesOutstanding: number | null;
  growthRate: number;
  discountRate: number;
  terminalGrowthRate: number;
};

const PROJECTION_YEARS = 5;

/**
 * Guard: growth used for the default 5-year projection is capped here.
 * Analyst `+1y` EPS growth and quarterly `revenueGrowth` (both used as
 * proxies for 5-year growth) are often one-off rebounds (e.g. DAL +46%),
 * and compounding them for 5 years under the original 6% discount rate produced
 * intrinsic values 3–4× the share price.
 */
export const MAX_DEFAULT_PROJECTION_GROWTH = 0.15;

/**
 * Guard: an intrinsic value more than this multiple of the trailing
 * P/E-implied value (EPS × P/E, i.e. what the market pays for current
 * earnings) is discarded as a data/assumption failure. Equivalent to a
 * margin of safety above ~66.7%.
 */
export const MAX_INTRINSIC_TO_PE_IMPLIED = 3;

export function calculateDCF(input: CalculateDcfInput): number | null {
  const {
    cashFlow,
    sharesOutstanding,
    growthRate,
    discountRate,
    terminalGrowthRate,
  } = input;

  if (cashFlow === null || sharesOutstanding === null) return null;
  if (!Number.isFinite(cashFlow) || cashFlow <= 0) return null;
  if (!Number.isFinite(sharesOutstanding) || sharesOutstanding <= 0) {
    return null;
  }

  const g = growthRate;
  const r = discountRate;
  const tg = terminalGrowthRate;
  const n = PROJECTION_YEARS;

  if (!Number.isFinite(g) || !Number.isFinite(r) || !Number.isFinite(tg)) {
    return null;
  }

  const denominator = r - tg;
  if (denominator <= 0.005) return null;

  let sumPv = 0;
  for (let year = 1; year <= n; year++) {
    const cfYear = cashFlow * (1 + g) ** year;
    const pv = cfYear / (1 + r) ** year;
    if (!Number.isFinite(pv)) return null;
    sumPv += pv;
  }

  const lastCf = cashFlow * (1 + g) ** n;
  const terminalValue = (lastCf * (1 + tg)) / denominator;
  const pvTerminal = terminalValue / (1 + r) ** n;
  if (!Number.isFinite(pvTerminal)) return null;

  const total = sumPv + pvTerminal;
  const intrinsic = total / sharesOutstanding;
  return Number.isFinite(intrinsic) ? intrinsic : null;
}

/**
 * Reference value for the sanity check: trailing EPS × trailing P/E when
 * both are usable (P/E in [5, 200]); otherwise the share price.
 */
export function peImpliedReferenceValue(
  price: number,
  trailingEps: number | null,
  trailingPE: number | null,
): number {
  if (
    trailingEps !== null &&
    trailingPE !== null &&
    Number.isFinite(trailingEps) &&
    Number.isFinite(trailingPE) &&
    trailingEps > 0 &&
    trailingPE >= 5 &&
    trailingPE <= 200
  ) {
    return trailingEps * trailingPE;
  }
  return price;
}

/** True when the intrinsic value is within the sanity bound. */
export function passesIntrinsicSanityCheck(
  intrinsicValue: number,
  referenceValue: number,
): boolean {
  if (!Number.isFinite(intrinsicValue) || !Number.isFinite(referenceValue)) {
    return false;
  }
  if (referenceValue <= 0) return true;
  return intrinsicValue <= referenceValue * MAX_INTRINSIC_TO_PE_IMPLIED;
}
