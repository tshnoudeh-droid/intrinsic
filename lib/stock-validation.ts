/** Price must be a finite number > 0 for display and downstream use. */
export function isValidMarketPrice(price: unknown): price is number {
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

/**
 * Cash flow used for DCF must be finite and strictly positive.
 * Non-positive or missing values are treated as unusable (null).
 */
export function sanitizeCashFlowForValuation(
  value: number | null | undefined,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return value;
}

/**
 * Shares outstanding must be finite and strictly positive.
 */
export function sanitizeSharesOutstanding(
  value: number | null | undefined,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return value;
}
