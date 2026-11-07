/** Formats currency-like figures: commas for smaller values; B/M suffix for large. */
export function formatCurrencyDisplay(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** One decimal place, for margin of safety and similar. */
export function formatPercentOneDecimal(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

/** Below this, the margin of safety is shown as "< -100%" (price > 2× intrinsic). */
const MARGIN_OF_SAFETY_DISPLAY_FLOOR = -100;

/**
 * Margin of safety = (intrinsic − price) / intrinsic, so it tops out at 100%
 * but is unbounded below (MSFT at ~26× its DCF value would read -2,535%).
 * Display-only clamp; stored/filtered values are unchanged.
 */
export function formatMarginOfSafety(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value < MARGIN_OF_SAFETY_DISPLAY_FLOOR) {
    return `< ${MARGIN_OF_SAFETY_DISPLAY_FLOOR}%`;
  }
  return formatPercentOneDecimal(value);
}
