export type ScreenerFilterField =
  | "margin_of_safety"
  | "valuation_label"
  | "market_cap"
  | "pe_ratio"
  | "forward_pe"
  | "revenue_growth"
  | "price";

export type ScreenerFilterOperator = "gt" | "gte" | "lt" | "lte" | "eq";

export type ScreenerFilter = {
  field: ScreenerFilterField;
  operator: ScreenerFilterOperator;
  value: number | string;
};

export type ScreenerValuationLabel = "Undervalued" | "Fair" | "Overvalued";

export type ScreenerStockRow = {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  intrinsic_value: number | null;
  margin_of_safety: number | null;
  valuation_label: ScreenerValuationLabel | null;
  market_cap: number | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  revenue_growth: number | null;
  updated_at: string;
};

export const SCREENER_FILTERABLE_FIELDS: readonly ScreenerFilterField[] = [
  "margin_of_safety",
  "valuation_label",
  "market_cap",
  "pe_ratio",
  "forward_pe",
  "revenue_growth",
  "price",
] as const;

export const SCREENER_FILTER_OPERATORS: readonly ScreenerFilterOperator[] = [
  "gt",
  "gte",
  "lt",
  "lte",
  "eq",
] as const;

export const SCREENER_VALUATION_LABELS: readonly ScreenerValuationLabel[] = [
  "Undervalued",
  "Fair",
  "Overvalued",
] as const;
