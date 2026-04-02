/** Hardcoded Smart Simplified DCF assumptions (v1). */
const GROWTH_RATE = 0.05;
const DISCOUNT_RATE = 0.09;
const TERMINAL_GROWTH_RATE = 0.025;
const YEARS = 5;

export type IntrinsicValueInput = {
  cashFlow: number | null | undefined;
  sharesOutstanding: number | null | undefined;
};

/**
 * Two-stage DCF: 5 years of growing cash flows + Gordon growth terminal value,
 * discounted to present value; divided by shares outstanding.
 */
export function calculateIntrinsicValue(
  input: IntrinsicValueInput,
): number | null {
  const { cashFlow, sharesOutstanding } = input;

  if (
    cashFlow === undefined ||
    cashFlow === null ||
    sharesOutstanding === undefined ||
    sharesOutstanding === null
  ) {
    return null;
  }

  if (!Number.isFinite(cashFlow) || !Number.isFinite(sharesOutstanding)) {
    return null;
  }

  if (sharesOutstanding <= 0) {
    return null;
  }

  const g = GROWTH_RATE;
  const r = DISCOUNT_RATE;
  const tg = TERMINAL_GROWTH_RATE;
  const n = YEARS;

  if (r <= tg) {
    return null;
  }

  let sumDcf = 0;
  for (let year = 1; year <= n; year++) {
    const projectedCf = cashFlow * (1 + g) ** year;
    const discountedCf = projectedCf / (1 + r) ** year;
    sumDcf += discountedCf;
  }

  const lastProjectedCf = cashFlow * (1 + g) ** n;
  const terminalValue =
    (lastProjectedCf * (1 + tg)) / (r - tg);
  const discountedTerminal = terminalValue / (1 + r) ** n;

  const totalValue = sumDcf + discountedTerminal;
  const intrinsicValue = totalValue / sharesOutstanding;

  return Number.isFinite(intrinsicValue) ? intrinsicValue : null;
}
