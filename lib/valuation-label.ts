/**
 * marginOfSafety is a percentage (e.g. 20 for 20%).
 * > 15% → Undervalued; [-15%, 15%] → Fair; < -15% → Overvalued.
 */
export function valuationLabelFromMargin(
  marginOfSafetyPercent: number,
): "Undervalued" | "Fair" | "Overvalued" {
  if (marginOfSafetyPercent > 15) return "Undervalued";
  if (marginOfSafetyPercent < -15) return "Overvalued";
  return "Fair";
}

export function marginOfSafetyPercent(
  intrinsicValue: number,
  price: number,
): number | null {
  if (!Number.isFinite(intrinsicValue) || !Number.isFinite(price) || price === 0) {
    return null;
  }
  return ((intrinsicValue - price) / price) * 100;
}
