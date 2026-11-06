/** Band (±) used for fair vs under/over labels and narrative copy. */
export const VALUATION_MARGIN_BAND_PCT = 15;

/**
 * marginOfSafety is a percentage (e.g. 20 for 20%), defined as
 * (intrinsic − price) / intrinsic × 100 — at most 100%.
 * > 15% (price at least 15% below intrinsic) → Undervalued;
 * < -15% (price more than 15% above intrinsic) → Overvalued; otherwise Fair.
 */
export function valuationLabelFromMargin(
  marginOfSafetyPercent: number,
): "Undervalued" | "Fair" | "Overvalued" {
  if (marginOfSafetyPercent > VALUATION_MARGIN_BAND_PCT) return "Undervalued";
  if (marginOfSafetyPercent < -VALUATION_MARGIN_BAND_PCT) return "Overvalued";
  return "Fair";
}

/**
 * Margin of safety = (intrinsic − price) / intrinsic × 100.
 * Bounded above by 100%; negative when price exceeds intrinsic value
 * (e.g. -50% means the price is 50% above the estimate).
 */
export function marginOfSafetyPercent(
  intrinsicValue: number,
  price: number,
): number | null {
  if (
    !Number.isFinite(intrinsicValue) ||
    !Number.isFinite(price) ||
    intrinsicValue <= 0 ||
    price <= 0
  ) {
    return null;
  }
  const m = ((intrinsicValue - price) / intrinsicValue) * 100;
  return Number.isFinite(m) ? m : null;
}
