/** Static copy for the stock detail page (keep out of component markup). */

export const STOCK_PAGE_COPY = {
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
