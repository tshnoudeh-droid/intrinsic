import type { GrowthSource } from "@/lib/stock-detail-types";

function analystSuffix(source: GrowthSource): string {
  return source === "analyst" ? " (analyst estimate)" : "";
}

/**
 * Stock-specific narrative for the “How to read this” card (uses live margin vs price).
 */
export function buildValuationExplanation(
  companyName: string,
  marginOfSafetyPercent: number,
  growthRateUsed: number,
  growthSource: GrowthSource,
  discountRate: number,
  label: "Undervalued" | "Fair" | "Overvalued",
  price: number,
  intrinsicValue: number,
): string {
  const discountPct = (discountRate * 100).toFixed(1);
  const growthPct = (growthRateUsed * 100).toFixed(1);
  const analyst = analystSuffix(growthSource);

  if (label === "Undervalued") {
    const pct = Math.abs(marginOfSafetyPercent).toFixed(0);
    return `Based on ${companyName}'s projected cash flows growing at ${growthPct}% annually${analyst} and discounted at ${discountPct}%, the stock appears to be trading below its estimated value by ${pct}%.`;
  }

  if (label === "Overvalued") {
    let premiumPct: string;
    if (
      intrinsicValue > 0 &&
      Number.isFinite(price) &&
      Number.isFinite(intrinsicValue)
    ) {
      premiumPct = ((price / intrinsicValue - 1) * 100).toFixed(0);
    } else {
      premiumPct = Math.abs(marginOfSafetyPercent).toFixed(0);
    }
    return `Based on ${companyName}'s projected cash flows growing at ${growthPct}% annually${analyst} and discounted at ${discountPct}%, the current price is ${premiumPct}% above the model's estimate. The market may be pricing in growth beyond what current financials support.`;
  }

  return `Based on ${companyName}'s projected cash flows growing at ${growthPct}% annually${analyst} and discounted at ${discountPct}%, the stock appears fairly valued relative to its estimated intrinsic value.`;
}
