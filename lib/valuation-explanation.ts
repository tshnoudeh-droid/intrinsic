import { DCF_ASSUMPTIONS } from "@/lib/calculate-intrinsic-value";
import { VALUATION_MARGIN_BAND_PCT } from "@/lib/valuation-label";

/**
 * Short narrative tied to margin-of-safety bands and published DCF assumptions.
 */
export function buildValuationExplanation(
  marginOfSafetyPercent: number,
  growthRateUsed: number,
): string {
  const discountPct = DCF_ASSUMPTIONS.discountRate * 100;

  let verdict: string;
  if (marginOfSafetyPercent > VALUATION_MARGIN_BAND_PCT) {
    verdict = "undervalued";
  } else if (marginOfSafetyPercent < -VALUATION_MARGIN_BAND_PCT) {
    verdict = "overvalued";
  } else {
    verdict = "fairly valued";
  }

  const growthPct = (growthRateUsed * 100).toFixed(1);

  return `This stock appears ${verdict} based on projected cash flows growing at ${growthPct}% annually and discounted at ${discountPct}%.`;
}
