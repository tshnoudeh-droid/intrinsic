export type StockDetailPayload = {
  symbol: string;
  name: string;
  price: number;
  intrinsicValue: number | null;
  /** Growth rate (decimal) used in the DCF, e.g. 0.05 for 5%. */
  growthRateUsed: number;
  /** Cash flow passed into DCF after validation (FCF from reported, else net income), or null. */
  cashFlowUsed: number | null;
  /** Share count from basic metric (millions × 1e6), after validation, or null. */
  sharesOutstanding: number | null;
};

export type StockApiError = {
  error: true;
};
