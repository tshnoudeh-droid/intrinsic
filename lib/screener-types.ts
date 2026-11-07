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

export type ScreenerAssetType = "stock" | "etf";

export const SCREENER_ASSET_TYPES: readonly ScreenerAssetType[] = [
  "stock",
  "etf",
] as const;

export type EtfCategory =
  | "us-total-market"
  | "sp500"
  | "canadian-equity"
  | "all-in-one"
  | "international"
  | "bonds"
  | "dividend"
  | "growth";

export const ETF_CATEGORIES: readonly EtfCategory[] = [
  "us-total-market",
  "sp500",
  "canadian-equity",
  "all-in-one",
  "international",
  "bonds",
  "dividend",
  "growth",
] as const;

/**
 * What the user seems to want beyond stock filters. `assetTypes` is ordered:
 * the first entry is shown first. `etfCategories` (optional) ranks the ETF
 * catalog.
 */
export type ScreenerIntent = {
  assetTypes: ScreenerAssetType[];
  etfCategories?: EtfCategory[];
};

export const DEFAULT_SCREENER_INTENT: ScreenerIntent = {
  assetTypes: ["stock", "etf"],
};

/** Response of POST /api/screener. */
export type ScreenerApiResponse = {
  error?: boolean;
  message?: string;
  filters?: ScreenerFilter[];
  /** Absent on older responses; treat as DEFAULT_SCREENER_INTENT. */
  intent?: ScreenerIntent;
  rows?: ScreenerStockRow[];
};

/** One ETF as served by GET /api/screener/etfs. All numbers live from Yahoo. */
export type ScreenerEtfRow = {
  symbol: string;
  name: string;
  category: EtfCategory;
  categoryLabel: string;
  currency: string | null;
  price: number | null;
  /** Decimal, e.g. 0.0003 for 0.03%. */
  expenseRatio: number | null;
  /** Trailing distribution yield, decimal. */
  dividendYield: number | null;
  /** Year-to-date return, decimal. */
  ytdReturn: number | null;
  /** Fund net assets in its trading currency. */
  netAssets: number | null;
};
