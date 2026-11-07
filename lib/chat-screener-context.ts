/**
 * Context + system prompt for the AI guide on /screener ("screener" chat
 * mode). The stock-page chat lives in lib/chat-context.ts and is unchanged.
 */

export type ChatScreenerStock = {
  symbol: string;
  name: string;
  sector: string | null;
  /** Pre-formatted for display, e.g. "$308.14", "+12%", "16.6x". */
  price: string;
  marginOfSafety: string;
  valuationLabel: string | null;
  peRatio: string;
  revenueGrowth: string;
  marketCap: string;
};

export type ChatScreenerEtf = {
  symbol: string;
  name: string;
  category: string;
  expenseRatio: string;
  dividendYield: string;
  ytdReturn: string;
};

/** Snapshot of what the screener shows, built client-side. */
export type ChatScreenerContext = {
  query: string;
  filters: string[];
  /** "etf" / "stock", best fit first. Empty before the first search. */
  assetTypes: string[];
  stockCount: number;
  stocks: ChatScreenerStock[];
  etfs: ChatScreenerEtf[];
};

const MAX_ITEMS = 8;
const MAX_FILTERS = 8;
const SHORT = 40;

function s(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function sOrNull(v: unknown, max: number): string | null {
  return typeof v === "string" && v ? v.slice(0, max) : null;
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function arr(v: unknown, max: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

/**
 * Rebuilds the context field-by-field from untrusted JSON: unknown keys are
 * dropped, strings clamped, arrays capped. Null if it isn't an object.
 */
export function sanitizeChatScreenerContext(
  raw: unknown,
): ChatScreenerContext | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    query: s(o.query, 500),
    filters: arr(o.filters, MAX_FILTERS)
      .map((f) => s(f, 80))
      .filter(Boolean),
    assetTypes: arr(o.assetTypes, 2).filter(
      (t): t is string => t === "etf" || t === "stock",
    ),
    stockCount:
      typeof o.stockCount === "number" && Number.isFinite(o.stockCount)
        ? Math.max(0, Math.min(10_000, Math.round(o.stockCount)))
        : 0,
    stocks: arr(o.stocks, MAX_ITEMS).map((x) => {
      const r = rec(x);
      return {
        symbol: s(r.symbol, 16),
        name: s(r.name, 120),
        sector: sOrNull(r.sector, 60),
        price: s(r.price, SHORT),
        marginOfSafety: s(r.marginOfSafety, SHORT),
        valuationLabel: sOrNull(r.valuationLabel, SHORT),
        peRatio: s(r.peRatio, SHORT),
        revenueGrowth: s(r.revenueGrowth, SHORT),
        marketCap: s(r.marketCap, SHORT),
      };
    }),
    etfs: arr(o.etfs, MAX_ITEMS).map((x) => {
      const r = rec(x);
      return {
        symbol: s(r.symbol, 16),
        name: s(r.name, 120),
        category: s(r.category, 60),
        expenseRatio: s(r.expenseRatio, SHORT),
        dividendYield: s(r.dividendYield, SHORT),
        ytdReturn: s(r.ytdReturn, SHORT),
      };
    }),
  };
}

export function buildScreenerSystemPrompt(ctx: ChatScreenerContext): string {
  const searched = ctx.query.length > 0;
  const stockLines =
    ctx.stocks.length > 0
      ? ctx.stocks
          .map(
            (r) =>
              `- ${r.symbol} (${r.name}${r.sector ? `, ${r.sector}` : ""}): price ${r.price}, margin of safety ${r.marginOfSafety}, ${r.valuationLabel ?? "no estimate"}, P/E ${r.peRatio}, revenue growth ${r.revenueGrowth}, market cap ${r.marketCap}`,
          )
          .join("\n")
      : "None shown.";
  const etfLines =
    ctx.etfs.length > 0
      ? ctx.etfs
          .map(
            (e) =>
              `- ${e.symbol} (${e.name}; ${e.category}): yearly fee ${e.expenseRatio}, yield ${e.dividendYield}, year-to-date ${e.ytdReturn}`,
          )
          .join("\n")
      : "None shown.";

  const screenState = searched
    ? `The user searched: "${ctx.query}"
Filters applied: ${ctx.filters.length > 0 ? ctx.filters.join("; ") : "none (ETF-style search)"}
Best fit order: ${ctx.assetTypes.join(" then ") || "stocks then ETFs"}
Matching stocks: ${ctx.stockCount}. Top ones on screen:
${stockLines}

ETFs on screen:
${etfLines}`
    : "The user hasn't searched yet. Help them work out what to look for.";

  return `You are Intrinsic AI, a friendly guide on the Screener page of Intrinsic, a beginner-friendly stock and ETF app for US and Canadian investors.

The screener covers S&P 500 and TSX 60 stocks (filters: margin of safety, valuation label, market cap, P/E, forward P/E, revenue growth, price, US vs Canadian listing) plus a short curated list of broad, low-cost US and Canadian ETFs (all-in-one portfolios, US total market, S&P 500, Canadian equity, international, dividend, bonds, Nasdaq-100).

${screenState}

How to help:
1. Help the user find what fits their goal. Ask at most one short clarifying question at a time, only when it would change the answer (time horizon, risk comfort, income vs growth, single stock vs a fund, US vs Canada).
2. For long-term, low-risk or hands-off goals, explain why a broad, low-fee ETF is usually a sensible starting point and why a single company is riskier.
3. When you mention a stock or ETF, only use ones listed above, with the numbers above. Never invent figures, tickers or holdings: don't quote expected or historical return percentages, and don't describe what a fund holds beyond its name and category. If you don't have a number, say so.
4. Margin of safety here = (Intrinsic's DCF estimate − price) / estimate. It's a model estimate, not a guarantee.
5. The screener does not list IPOs or brand-new companies (it covers large index members). If asked about newer companies or IPOs, explain what an IPO is and the extra risk of a short track record, and say they can look up any ticker in the search bar.
6. You can suggest a new search phrase in quotes, e.g. try "dividend ETFs".
7. Educational only, not personal financial advice; say so briefly when the user asks what they should buy.
8. Keep replies short: 2-5 sentences or a few bullets. Plain text only: no markdown (no **bold**, headings or tables), no LaTeX.`;
}
