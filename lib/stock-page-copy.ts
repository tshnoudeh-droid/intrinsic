/** Static copy for the stock detail page (keep out of component markup). */

export const STOCK_PAGE_COPY = {
  /** Yahoo consolidated quotes are typically delayed ~15 minutes vs live exchange tape (non–real-time feeds). */
  marketDataDelayNote:
    "Prices and charts reflect Yahoo Finance data (exchange-listed symbols). Quotes are typically delayed by about 15 minutes compared with the live tape. The chart uses split-adjusted daily closes so multi‑month ranges stay on one consistent basis (the large headline price is the latest quote).",
  valuationUnavailableTitle: "Valuation unavailable",
  valuationUnavailableBody:
    "Not enough financial data to generate a reliable valuation for this stock.",
  loadError: "Failed to load data. Please try again.",
  loading: "Loading stock data...",
  disclaimer:
    "Intrinsic values are estimates based on simplified financial models and should not be considered financial advice.",
  modelAssumptionsTitle: "Model assumptions",
  explanationSectionTitle: "How to read this",
  tfsaNote:
    "For Canadian investors using a TFSA, a margin of safety above 15% is often preferred for long-term investing.",
  unreliableEstimate:
    "Estimate may be unreliable due to data limitations.",
} as const;
