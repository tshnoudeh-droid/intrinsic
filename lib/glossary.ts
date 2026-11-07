/** Short, static, plain-English definitions for beginner investors. */

export type GlossaryKey =
  | "etf"
  | "index-fund"
  | "ipo"
  | "pe"
  | "margin-of-safety"
  | "market-cap"
  | "revenue-growth"
  | "dividend"
  | "expense-ratio"
  | "yield"
  | "ytd"
  | "valuation"
  | "discount-rate";

export type GlossaryEntry = { term: string; definition: string };

export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  etf: {
    term: "ETF",
    definition:
      "An exchange-traded fund: one share you buy like a stock, but it holds many investments at once (often hundreds of companies), so your money is spread out.",
  },
  "index-fund": {
    term: "Index fund",
    definition:
      "A fund that simply copies a market index, like the S&P 500, instead of picking stocks. Usually cheap, diversified and hands-off.",
  },
  ipo: {
    term: "IPO",
    definition:
      "Initial public offering: the first time a private company sells shares to the public. Newly listed companies have short track records, so they can swing a lot.",
  },
  pe: {
    term: "P/E ratio",
    definition:
      "Price-to-earnings: the share price divided by yearly profit per share. A P/E of 20 means you pay $20 for every $1 of annual profit. Lower can mean cheaper.",
  },
  "margin-of-safety": {
    term: "Margin of safety",
    definition:
      "How far the price sits below Intrinsic's estimate of what the business is worth. Positive means the price is under our estimate. It's a model estimate, not a promise.",
  },
  "market-cap": {
    term: "Market cap",
    definition:
      "The total value of all a company's shares (price × number of shares). Bigger companies tend to be more established and less jumpy.",
  },
  "revenue-growth": {
    term: "Revenue growth",
    definition:
      "How much a company's sales grew compared with a year earlier. Steady growth is a sign the business is expanding.",
  },
  dividend: {
    term: "Dividend",
    definition:
      "Cash a company or fund pays out to shareholders regularly, usually every quarter. Popular with people who want income.",
  },
  "expense-ratio": {
    term: "Fee (expense ratio)",
    definition:
      "What a fund charges each year, as a percent of your money. 0.20% means $2 a year for every $1,000 invested.",
  },
  yield: {
    term: "Yield",
    definition:
      "Yearly payouts (dividends or interest) as a percent of the price. A 3% yield pays about $30 a year per $1,000 invested.",
  },
  ytd: {
    term: "YTD",
    definition:
      "Year to date: how much the price has changed since January 1 of this year. Past performance doesn't predict the future.",
  },
  valuation: {
    term: "Valuation",
    definition:
      "Intrinsic's verdict from its DCF model: Undervalued (price well below our estimate), Fair, or Overvalued (price well above it).",
  },
  "discount-rate": {
    term: "Discount rate",
    definition:
      "The yearly return you'd want for taking the risk of owning a stock. Intrinsic uses 9% by default (Balanced): a safe government bond pays about 4%, plus about 5% for the extra risk of stocks. A higher rate is more cautious and makes fewer stocks look cheap.",
  },
};
