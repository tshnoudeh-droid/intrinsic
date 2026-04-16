import type { UnavailableReason } from "@/lib/stock-detail-types";

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
  valuationUnavailableDcfNote:
    "DCF valuation works best for profitable companies with at least 2 years of cash flow history.",
  extremeOvervaluedBanner:
    "This stock is priced far above its DCF value. This is common for high-growth or story stocks where the market is pricing in future potential that a cash flow model doesn't capture. Use the sliders below to adjust growth assumptions and find the price that makes sense for you.",
  extremeUndervaluedBanner:
    "This stock appears significantly undervalued by DCF. Before acting on this, verify the financial data is current and consider why the market may be pricing it lower — there may be risks the model doesn't capture.",
  valuationCardOvervaluedExtremeNote:
    "The market may be pricing in growth beyond what this model assumes.",
  valuationCardUndervaluedStrongNote:
    "Verify data quality before drawing conclusions.",
  valuationCardFairNote:
    "Price aligns closely with estimated cash flow value.",
} as const;

export const VALUATION_UNAVAILABLE_BODY_BY_REASON: Record<
  UnavailableReason,
  string
> = {
  no_cash_flow_data:
    "This stock doesn't have enough cash flow history for a reliable DCF valuation. This is common for newly listed companies, pre-profit startups, or stocks with limited financial reporting.",
  negative_cash_flow:
    "This company currently has negative cash flows, which means a DCF model can't produce a meaningful intrinsic value. This is common for high-growth companies reinvesting heavily.",
  no_shares_data:
    "We couldn't retrieve shares outstanding data for this stock. This is sometimes the case for smaller or internationally listed companies.",
  insufficient_data:
    "Not enough financial data to generate a reliable valuation for this stock.",
  calculation_error:
    "The valuation result failed a sanity check against the reported price and was discarded. This can happen when underlying financial figures are scaled inconsistently.",
  negative_result:
    "The model produced a negative intrinsic value, which is not shown as a usable estimate.",
};
