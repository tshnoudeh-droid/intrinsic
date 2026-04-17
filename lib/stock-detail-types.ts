export type UnavailableReason =
  | "no_cash_flow_data"
  | "negative_cash_flow"
  | "no_shares_data"
  | "insufficient_data"
  | "calculation_error"
  | "negative_result";

/** How the default growth rate was chosen (server-side). */
export type GrowthSource = "analyst" | "historical" | "default";

export type StockDetailPayload = {
  symbol: string;
  name: string;
  price: number;
  intrinsicValue: number | null;
  /** Growth rate (decimal) used in the DCF, e.g. 0.05 for 5%. */
  growthRateUsed: number;
  growthSource: GrowthSource;
  /** Discount rate (decimal) used in the API’s intrinsic snapshot, e.g. 0.06. */
  discountRateUsed: number;
  /** Cash flow passed into DCF after validation (FCF from reported, else net income), or null. */
  cashFlowUsed: number | null;
  /** Share count from basic metric (millions × 1e6), after validation, or null. */
  sharesOutstanding: number | null;
  unavailableReason: UnavailableReason | null;
  marketCap: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  /** Revenue growth as decimal (e.g. 0.12 for 12%), or null. */
  revenueGrowth: number | null;
  week52High: number | null;
  week52Low: number | null;
  /** Context for regulated / high-debt Canadian names; null when not applicable. */
  regulatoryNote?: string | null;
};

export type StockApiError = {
  error: true;
};
