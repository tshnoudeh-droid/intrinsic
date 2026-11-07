import { DCF_ASSUMPTIONS } from "@/lib/calculate-intrinsic-value";

/**
 * Beginner-friendly framing of the discount rate: "how cautious am I?"
 * instead of a raw percentage. Balanced is the model default.
 */
export type DiscountPresetId = "cautious" | "balanced" | "optimistic";

export type DiscountPreset = {
  id: DiscountPresetId;
  label: string;
  rate: number;
  blurb: string;
};

export const DISCOUNT_PRESETS: readonly DiscountPreset[] = [
  {
    id: "cautious",
    label: "Cautious",
    rate: 0.1,
    blurb: "Demands about 10% a year, roughly the stock market's long-run average. Fewer stocks look cheap.",
  },
  {
    id: "balanced",
    label: "Balanced",
    rate: DCF_ASSUMPTIONS.discountRate,
    blurb: "About 9% a year: a safe government bond (~4%) plus ~5% for the extra risk of owning stocks.",
  },
  {
    id: "optimistic",
    label: "Optimistic",
    rate: 0.07,
    blurb: "Accepts about 7% a year. More stocks look cheap, with a thinner cushion if things go wrong.",
  },
] as const;

/** Preset whose rate matches (within float noise), or null for a custom slider value. */
export function presetForRate(rate: number): DiscountPreset | null {
  return DISCOUNT_PRESETS.find((p) => Math.abs(p.rate - rate) < 1e-9) ?? null;
}

export const DISCOUNT_RATE_AI_QUESTION =
  "What is the discount rate, and should I pick Cautious, Balanced or Optimistic for this stock?";
