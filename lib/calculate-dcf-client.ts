/**
 * Client-side DCF matching the backend two-stage model (5 projection years + terminal value).
 */
export type CalculateDcfInput = {
  cashFlow: number | null;
  sharesOutstanding: number | null;
  growthRate: number;
  discountRate: number;
  terminalGrowthRate: number;
};

const PROJECTION_YEARS = 5;

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
