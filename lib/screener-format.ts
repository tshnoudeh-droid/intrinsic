import {
  isCategoricalField,
  type ScreenerFilter,
  type ScreenerFilterField,
  type ScreenerFilterOperator,
  type ScreenerNumericField,
} from "@/lib/screener-types";

/**
 * Every screener number is formatted here so storage units (see
 * lib/screener-types.ts / supabase/schema.sql) can be adjusted in one place:
 * - margin_of_safety: percent, e.g. 20 for 20%
 * - revenue_growth: decimal, e.g. 0.1 for 10%
 * - market_cap / price: currency units
 * - pe_ratio / forward_pe: plain multiple
 */

const DASH = "—";

function finite(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

export function currencyPrefix(currency: string | null | undefined): string {
  switch ((currency ?? "USD").toUpperCase()) {
    case "CAD":
      return "C$";
    case "USD":
      return "$";
    default:
      return `${currency} `;
  }
}

/** Currency implied by the screener row's exchange ("TSX" rows trade in CAD). */
export function currencyForExchange(exchange: string | null | undefined): string {
  return exchange === "TSX" ? "CAD" : "USD";
}

export function formatPrice(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (!finite(value)) return DASH;
  return `${currencyPrefix(currency)}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** $1.2T / $85B / $640M — compact, no trailing ".0". */
export function formatMarketCap(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (!finite(value)) return DASH;
  const prefix = currencyPrefix(currency);
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${prefix}${trimZeros((value / 1e12).toFixed(2))}T`;
  if (abs >= 1e9) {
    return `${prefix}${trimZeros((value / 1e9).toFixed(abs >= 1e11 ? 0 : 1))}B`;
  }
  if (abs >= 1e6) return `${prefix}${trimZeros((value / 1e6).toFixed(0))}M`;
  return `${prefix}${Math.round(value).toLocaleString("en-US")}`;
}

export function formatPe(value: number | null | undefined): string {
  if (!finite(value) || value <= 0) return DASH;
  return value >= 100 ? `${Math.round(value)}x` : `${value.toFixed(1)}x`;
}

/** Decimal growth (0.034) → "+3.4%". */
export function formatGrowth(value: number | null | undefined): string {
  if (!finite(value)) return DASH;
  const pct = value * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/**
 * Margin of safety stored as a percent, (intrinsic − price) / intrinsic:
 * max 100, unbounded below (20 → "+20%", -250 → "< -100%").
 */
export function formatMarginOfSafety(value: number | null | undefined): string {
  if (!finite(value)) return DASH;
  if (value < -100) return "< -100%";
  const rounded = Math.abs(value) >= 10 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("en-US")}%`;
}

/** Decimal fraction (0.0003) → "0.03%". Used for ETF fees / yields / returns. */
export function formatPercentDecimal(
  value: number | null | undefined,
  options: { signed?: boolean; digits?: number } = {},
): string {
  if (!finite(value)) return DASH;
  const pct = value * 100;
  const digits = options.digits ?? (Math.abs(pct) < 1 ? 2 : 1);
  const body = pct.toFixed(digits);
  return `${options.signed && pct > 0 ? "+" : ""}${body}%`;
}

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

export const FILTER_FIELD_LABELS: Record<ScreenerFilterField, string> = {
  margin_of_safety: "Margin of safety",
  valuation_label: "Valuation",
  exchange: "Listed in",
  market_cap: "Market cap",
  pe_ratio: "P/E",
  forward_pe: "Forward P/E",
  revenue_growth: "Revenue growth",
  price: "Price",
};

export const FILTER_OPERATOR_SYMBOLS: Record<ScreenerFilterOperator, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  eq: "=",
};

/** Unit the filter editor shows for a numeric field. */
export type FilterEditUnit = {
  prefix: string;
  suffix: string;
  /** Multiply the stored value by this to get the editable number. */
  scale: number;
};

export const FILTER_EDIT_UNITS: Record<
  ScreenerNumericField,
  FilterEditUnit
> = {
  margin_of_safety: { prefix: "", suffix: "%", scale: 1 },
  market_cap: { prefix: "$", suffix: "B", scale: 1e-9 },
  pe_ratio: { prefix: "", suffix: "x", scale: 1 },
  forward_pe: { prefix: "", suffix: "x", scale: 1 },
  revenue_growth: { prefix: "", suffix: "%", scale: 100 },
  price: { prefix: "$", suffix: "", scale: 1 },
};

function roundForDisplay(n: number): number {
  return Number(n.toFixed(Math.abs(n) >= 100 ? 0 : 2));
}

export function filterValueToEditable(filter: ScreenerFilter): number | null {
  if (isCategoricalField(filter.field) || typeof filter.value !== "number") {
    return null;
  }
  return roundForDisplay(filter.value * FILTER_EDIT_UNITS[filter.field].scale);
}

export function editableToFilterValue(
  field: ScreenerNumericField,
  editable: number,
): number {
  const raw = editable / FILTER_EDIT_UNITS[field].scale;
  // Avoid float noise like 0.030000000000000002.
  return Number(raw.toPrecision(12));
}

function formatFilterValue(filter: ScreenerFilter): string {
  if (filter.field === "exchange") {
    return filter.value === "TSX" ? "Canada (TSX)" : "US";
  }
  if (typeof filter.value === "string") return filter.value;
  switch (filter.field) {
    case "market_cap":
      return formatMarketCap(filter.value);
    case "revenue_growth":
      return `${trimZeros((filter.value * 100).toFixed(1))}%`;
    case "margin_of_safety":
      return `${trimZeros(filter.value.toFixed(1))}%`;
    case "price":
      return `$${trimZeros(filter.value.toFixed(2))}`;
    default:
      return trimZeros(filter.value.toFixed(2));
  }
}

/** "Market cap ≥ $50B", "Revenue growth ≥ 3%", "Valuation: Undervalued". */
export function formatFilterChip(filter: ScreenerFilter): string {
  const label = FILTER_FIELD_LABELS[filter.field] ?? filter.field;
  if (isCategoricalField(filter.field)) {
    return `${label}: ${formatFilterValue(filter)}`;
  }
  const op = FILTER_OPERATOR_SYMBOLS[filter.operator] ?? filter.operator;
  return `${label} ${op} ${formatFilterValue(filter)}`;
}
