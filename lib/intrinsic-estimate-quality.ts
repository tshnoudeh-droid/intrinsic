/**
 * Flags DCF outputs that are extreme vs. market price so we can show a subtle warning.
 * Does not change the displayed number.
 */
export function isIntrinsicEstimatePotentiallyUnreliable(
  intrinsicValue: number,
  price: number,
): boolean {
  if (!Number.isFinite(intrinsicValue) || !Number.isFinite(price) || price <= 0) {
    return false;
  }
  if (intrinsicValue > price * 10) return true;
  const tiny = Math.max(price * 0.001, 0.01);
  if (intrinsicValue > 0 && intrinsicValue < tiny) return true;
  return false;
}
